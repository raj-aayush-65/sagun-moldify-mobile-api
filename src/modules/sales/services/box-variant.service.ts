import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BoxVariant } from '../entities/box-variant.entity';
import { StockEntry } from '../entities/stock-entry.entity';
import { SaleItem } from '../entities/sale-item.entity';
import { CreateBoxVariantDto, UpdateBoxVariantDto } from '../dto/box-variant.dto';

@Injectable()
export class BoxVariantService {
  constructor(
    @InjectRepository(BoxVariant)
    private readonly boxVariantRepo: Repository<BoxVariant>,
    @InjectRepository(StockEntry)
    private readonly stockEntryRepo: Repository<StockEntry>,
    @InjectRepository(SaleItem)
    private readonly saleItemRepo: Repository<SaleItem>
  ) {}

  async create(dto: CreateBoxVariantDto, userId: string): Promise<BoxVariant> {
    await this.checkUniqueName(dto.name.trim());

    const variant = this.boxVariantRepo.create({
      name: dto.name.trim(),
      piecesPerBox: dto.piecesPerBox,
      isActive: true,
      createdBy: userId,
    });

    return this.boxVariantRepo.save(variant);
  }

  async update(id: string, dto: UpdateBoxVariantDto, userId: string): Promise<BoxVariant> {
    const variant = await this.findById(id);

    if (dto.name !== undefined && dto.name.trim().toLowerCase() !== variant.name.toLowerCase()) {
      await this.checkUniqueName(dto.name.trim(), id);
      variant.name = dto.name.trim();
    }

    if (dto.piecesPerBox !== undefined) variant.piecesPerBox = dto.piecesPerBox;
    if (dto.isActive !== undefined) variant.isActive = dto.isActive;
    variant.updatedBy = userId;

    return this.boxVariantRepo.save(variant);
  }

  async delete(id: string): Promise<void> {
    const variant = await this.findById(id);

    // Check if any stock entries or sale items reference this variant
    const stockCount = await this.stockEntryRepo.count({
      where: { boxVariantId: variant.id },
    });
    if (stockCount > 0) {
      throw new ConflictException('BOX_VARIANT_HAS_STOCK');
    }

    const saleItemCount = await this.saleItemRepo.count({
      where: { boxVariantId: variant.id },
    });
    if (saleItemCount > 0) {
      throw new ConflictException('BOX_VARIANT_HAS_SALES');
    }

    await this.boxVariantRepo.remove(variant);
  }

  async findAll(isActive?: boolean): Promise<BoxVariant[]> {
    const qb = this.boxVariantRepo.createQueryBuilder('bv');

    if (isActive !== undefined) {
      qb.where('bv.isActive = :isActive', { isActive });
    }

    qb.orderBy('bv.name', 'ASC');
    return qb.getMany();
  }

  async findById(id: string): Promise<BoxVariant> {
    const variant = await this.boxVariantRepo.findOne({ where: { id } });
    if (!variant) {
      throw new NotFoundException('Box variant not found');
    }
    return variant;
  }

  private async checkUniqueName(name: string, excludeId?: string): Promise<void> {
    const qb = this.boxVariantRepo
      .createQueryBuilder('bv')
      .where('LOWER(bv.name) = LOWER(:name)', { name });

    if (excludeId) {
      qb.andWhere('bv.id != :excludeId', { excludeId });
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new ConflictException('BOX_VARIANT_NAME_DUPLICATE');
    }
  }
}
