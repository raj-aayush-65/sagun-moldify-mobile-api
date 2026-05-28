import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { PrintingRecord } from '../entities/printing-record.entity';
import { Party } from '../entities/party.entity';
import { Product } from '../entities/product.entity';
import { TfmProductionOutput } from '../entities/tfm-production-output.entity';
import { CreatePrintingRecordDto, UpdatePrintingRecordDto } from '../dto/printing.dto';

@Injectable()
export class PrintingService {
  constructor(
    @InjectRepository(PrintingRecord)
    private readonly printingRecordRepository: Repository<PrintingRecord>,
    @InjectRepository(Party)
    private readonly partyRepository: Repository<Party>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(TfmProductionOutput)
    private readonly tfmProductionOutputRepository: Repository<TfmProductionOutput>
  ) {}

  async create(
    dto: CreatePrintingRecordDto,
    userId: string
  ): Promise<{ record: PrintingRecord; printExceedsProduction: boolean }> {
    // Validate party exists and is active
    const party = await this.partyRepository.findOne({
      where: { id: dto.partyId },
    });
    if (!party || !party.isActive) {
      throw new BadRequestException('INVALID_PARTY');
    }

    // Validate product exists and is active
    const product = await this.productRepository.findOne({
      where: { id: dto.productId },
    });
    if (!product || !product.isActive) {
      throw new BadRequestException('INVALID_PRODUCT');
    }

    // Check if cumulative printed quantity exceeds cumulative TFM production
    const printExceedsProduction = await this.checkPrintExceedsProduction(
      dto.productId,
      dto.date,
      dto.quantity
    );

    // Persist record
    const record = this.printingRecordRepository.create({
      date: dto.date,
      shift: dto.shift,
      printerMachine: dto.printerMachine,
      partyId: dto.partyId,
      productId: dto.productId,
      quantity: dto.quantity,
      createdBy: userId,
    });

    const savedRecord = await this.printingRecordRepository.save(record);

    return { record: savedRecord, printExceedsProduction };
  }

  async update(id: string, dto: UpdatePrintingRecordDto, userId: string): Promise<PrintingRecord> {
    const record = await this.printingRecordRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!record) {
      throw new NotFoundException('Printing record not found');
    }

    // Validate party if changed
    if (dto.partyId !== undefined && dto.partyId !== record.partyId) {
      const party = await this.partyRepository.findOne({
        where: { id: dto.partyId },
      });
      if (!party || !party.isActive) {
        throw new BadRequestException('INVALID_PARTY');
      }
      record.partyId = dto.partyId;
    }

    // Validate product if changed
    if (dto.productId !== undefined && dto.productId !== record.productId) {
      const product = await this.productRepository.findOne({
        where: { id: dto.productId },
      });
      if (!product || !product.isActive) {
        throw new BadRequestException('INVALID_PRODUCT');
      }
      record.productId = dto.productId;
    }

    // Update other fields
    if (dto.date !== undefined) {
      record.date = dto.date;
    }
    if (dto.shift !== undefined) {
      record.shift = dto.shift;
    }
    if (dto.printerMachine !== undefined) {
      record.printerMachine = dto.printerMachine;
    }
    if (dto.quantity !== undefined) {
      record.quantity = dto.quantity;
    }

    // Update audit fields
    record.updatedBy = userId;

    return this.printingRecordRepository.save(record);
  }

  async delete(id: string, userId: string): Promise<void> {
    const record = await this.printingRecordRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!record) {
      throw new NotFoundException('Printing record not found');
    }

    // Soft-delete
    record.deletedAt = new Date();
    record.deletedBy = userId;

    await this.printingRecordRepository.save(record);
  }

  async list(filters: {
    dateFrom?: string;
    dateTo?: string;
    shift?: string;
    printerMachine?: string;
    partyId?: string;
    productId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: PrintingRecord[];
    total: number;
    page: number;
    pageSize: number;
    hasNextPage: boolean;
  }> {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;

    const query = this.printingRecordRepository
      .createQueryBuilder('pr')
      .leftJoinAndSelect('pr.party', 'party')
      .leftJoinAndSelect('pr.product', 'product')
      .where('pr.deletedAt IS NULL');

    if (filters.dateFrom) {
      query.andWhere('pr.date >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      query.andWhere('pr.date <= :dateTo', { dateTo: filters.dateTo });
    }
    if (filters.shift) {
      query.andWhere('pr.shift = :shift', { shift: filters.shift });
    }
    if (filters.printerMachine) {
      query.andWhere('pr.printerMachine = :printerMachine', {
        printerMachine: filters.printerMachine,
      });
    }
    if (filters.partyId) {
      query.andWhere('pr.partyId = :partyId', { partyId: filters.partyId });
    }
    if (filters.productId) {
      query.andWhere('pr.productId = :productId', {
        productId: filters.productId,
      });
    }

    // Sort by date DESC then shift
    query.orderBy('pr.date', 'DESC').addOrderBy('pr.shift', 'ASC');

    // Pagination
    const total = await query.getCount();
    const items = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    const hasNextPage = page * pageSize < total;

    return { items, total, page, pageSize, hasNextPage };
  }

  async findById(id: string): Promise<PrintingRecord> {
    const record = await this.printingRecordRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['party', 'product'],
    });

    if (!record) {
      throw new NotFoundException('Printing record not found');
    }

    return record;
  }

  /**
   * Check if cumulative printed quantity for this product on this date
   * exceeds cumulative TFM production output up to and including this date.
   */
  private async checkPrintExceedsProduction(
    productId: string,
    date: string,
    newQuantity: number
  ): Promise<boolean> {
    // Sum of all printing records for this product up to and including this date (non-deleted)
    const printedResult = await this.printingRecordRepository
      .createQueryBuilder('pr')
      .select('COALESCE(SUM(pr.quantity), 0)', 'total')
      .where('pr.productId = :productId', { productId })
      .andWhere('pr.date <= :date', { date })
      .andWhere('pr.deletedAt IS NULL')
      .getRawOne();

    const cumulativePrinted = parseInt(printedResult?.total || '0', 10) + newQuantity;

    // Sum of TFM production output for this product up to and including this date
    const tfmResult = await this.tfmProductionOutputRepository
      .createQueryBuilder('tpo')
      .innerJoin('tpo.tfmProductionRecord', 'tpr')
      .select('COALESCE(SUM(tpo.quantity), 0)', 'total')
      .where('tpo.productId = :productId', { productId })
      .andWhere('tpr.date <= :date', { date })
      .getRawOne();

    const cumulativeTfmProduction = parseInt(tfmResult?.total || '0', 10);

    return cumulativePrinted > cumulativeTfmProduction;
  }
}
