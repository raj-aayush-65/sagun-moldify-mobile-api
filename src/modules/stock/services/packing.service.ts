import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { PackingRecord } from '../entities/packing-record.entity';
import { Party } from '../entities/party.entity';
import { Product } from '../entities/product.entity';
import { PrintingRecord } from '../entities/printing-record.entity';
import { CreatePackingRecordDto, UpdatePackingRecordDto } from '../dto/packing.dto';

@Injectable()
export class PackingService {
  constructor(
    @InjectRepository(PackingRecord)
    private readonly packingRecordRepository: Repository<PackingRecord>,
    @InjectRepository(Party)
    private readonly partyRepository: Repository<Party>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(PrintingRecord)
    private readonly printingRecordRepository: Repository<PrintingRecord>
  ) {}

  async create(
    dto: CreatePackingRecordDto,
    userId: string
  ): Promise<PackingRecord & { packExceedsPrint: boolean }> {
    // Validate party exists and is active
    const party = await this.partyRepository.findOne({ where: { id: dto.partyId } });
    if (!party || !party.isActive) {
      throw new BadRequestException('INVALID_PARTY');
    }

    // Validate product exists and is active
    const product = await this.productRepository.findOne({ where: { id: dto.productId } });
    if (!product || !product.isActive) {
      throw new BadRequestException('INVALID_PRODUCT');
    }

    // Compute totalCups
    const totalCups = dto.boxCount * product.quantityPerBox + (dto.looseCups || 0);

    // Check if cumulative packed quantity exceeds cumulative printed quantity
    const packExceedsPrint = await this.checkPackExceedsPrint(
      dto.partyId,
      dto.productId,
      totalCups
    );

    // Persist record
    const record = this.packingRecordRepository.create({
      date: dto.date,
      shift: dto.shift,
      partyId: dto.partyId,
      productId: dto.productId,
      boxCount: dto.boxCount,
      looseCups: dto.looseCups || 0,
      totalCups,
      createdBy: userId,
    });

    const saved = await this.packingRecordRepository.save(record);

    return { ...saved, packExceedsPrint };
  }

  async update(
    id: string,
    dto: UpdatePackingRecordDto,
    userId: string
  ): Promise<PackingRecord & { packExceedsPrint: boolean }> {
    const record = await this.packingRecordRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!record) {
      throw new NotFoundException('Packing record not found');
    }

    // Validate party if changed
    if (dto.partyId !== undefined && dto.partyId !== record.partyId) {
      const party = await this.partyRepository.findOne({ where: { id: dto.partyId } });
      if (!party || !party.isActive) {
        throw new BadRequestException('INVALID_PARTY');
      }
      record.partyId = dto.partyId;
    }

    // Validate product if changed
    if (dto.productId !== undefined && dto.productId !== record.productId) {
      const product = await this.productRepository.findOne({ where: { id: dto.productId } });
      if (!product || !product.isActive) {
        throw new BadRequestException('INVALID_PRODUCT');
      }
      record.productId = dto.productId;
    }

    // Update fields
    if (dto.date !== undefined) {
      record.date = dto.date;
    }
    if (dto.shift !== undefined) {
      record.shift = dto.shift;
    }
    if (dto.boxCount !== undefined) {
      record.boxCount = dto.boxCount;
    }
    if (dto.looseCups !== undefined) {
      record.looseCups = dto.looseCups;
    }

    // Recompute totalCups
    const product = await this.productRepository.findOne({ where: { id: record.productId } });
    if (!product) {
      throw new BadRequestException('INVALID_PRODUCT');
    }
    record.totalCups = record.boxCount * product.quantityPerBox + (record.looseCups || 0);

    // Update audit
    record.updatedBy = userId;

    const saved = await this.packingRecordRepository.save(record);

    // Check warning after update
    const packExceedsPrint = await this.checkPackExceedsPrint(
      record.partyId,
      record.productId,
      0 // already saved, check cumulative totals
    );

    return { ...saved, packExceedsPrint };
  }

  async delete(id: string, userId: string): Promise<void> {
    const record = await this.packingRecordRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!record) {
      throw new NotFoundException('Packing record not found');
    }

    record.deletedAt = new Date();
    record.deletedBy = userId;

    await this.packingRecordRepository.save(record);
  }

  async list(filters: {
    dateFrom?: string;
    dateTo?: string;
    shift?: string;
    partyId?: string;
    productId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: PackingRecord[];
    total: number;
    page: number;
    pageSize: number;
    hasNextPage: boolean;
  }> {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;

    const query = this.packingRecordRepository
      .createQueryBuilder('packing')
      .leftJoinAndSelect('packing.party', 'party')
      .leftJoinAndSelect('packing.product', 'product')
      .where('packing.deletedAt IS NULL');

    if (filters.dateFrom) {
      query.andWhere('packing.date >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      query.andWhere('packing.date <= :dateTo', { dateTo: filters.dateTo });
    }
    if (filters.shift) {
      query.andWhere('packing.shift = :shift', { shift: filters.shift });
    }
    if (filters.partyId) {
      query.andWhere('packing.partyId = :partyId', { partyId: filters.partyId });
    }
    if (filters.productId) {
      query.andWhere('packing.productId = :productId', { productId: filters.productId });
    }

    // Sort by date DESC then shift
    query.orderBy('packing.date', 'DESC').addOrderBy('packing.shift', 'ASC');

    const total = await query.getCount();
    const items = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    const hasNextPage = page * pageSize < total;

    return { items, total, page, pageSize, hasNextPage };
  }

  async findById(id: string): Promise<PackingRecord> {
    const record = await this.packingRecordRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['party', 'product'],
    });

    if (!record) {
      throw new NotFoundException('Packing record not found');
    }

    return record;
  }

  /**
   * Check if cumulative packed quantity for a party+product exceeds
   * cumulative printed quantity for the same party+product.
   * Returns true if pack exceeds print (warning flag).
   */
  private async checkPackExceedsPrint(
    partyId: string,
    productId: string,
    additionalCups: number
  ): Promise<boolean> {
    // Sum of all non-deleted packing records for this party+product
    const packingResult = await this.packingRecordRepository
      .createQueryBuilder('packing')
      .select('COALESCE(SUM(packing.totalCups), 0)', 'total')
      .where('packing.partyId = :partyId', { partyId })
      .andWhere('packing.productId = :productId', { productId })
      .andWhere('packing.deletedAt IS NULL')
      .getRawOne();

    const totalPacked = Number(packingResult?.total || 0) + additionalCups;

    // Sum of all non-deleted printing records for this party+product
    const printingResult = await this.printingRecordRepository
      .createQueryBuilder('printing')
      .select('COALESCE(SUM(printing.quantity), 0)', 'total')
      .where('printing.partyId = :partyId', { partyId })
      .andWhere('printing.productId = :productId', { productId })
      .andWhere('printing.deletedAt IS NULL')
      .getRawOne();

    const totalPrinted = Number(printingResult?.total || 0);

    return totalPacked > totalPrinted;
  }
}
