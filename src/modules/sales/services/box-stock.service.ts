import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockEntry } from '../entities/stock-entry.entity';
import { SaleItem } from '../entities/sale-item.entity';
import { BoxVariant } from '../entities/box-variant.entity';
import { CreateStockEntryDto } from '../dto/stock-entry.dto';

export interface StockLevel {
  boxVariantId: string;
  boxVariantName: string;
  piecesPerBox: number;
  totalAdded: number;
  totalSold: number;
  currentStock: number;
}

@Injectable()
export class BoxStockService {
  constructor(
    @InjectRepository(StockEntry)
    private readonly stockEntryRepo: Repository<StockEntry>,
    @InjectRepository(SaleItem)
    private readonly saleItemRepo: Repository<SaleItem>,
    @InjectRepository(BoxVariant)
    private readonly boxVariantRepo: Repository<BoxVariant>
  ) {}

  async addStock(dto: CreateStockEntryDto, userId: string): Promise<StockEntry> {
    // Verify variant exists
    const variant = await this.boxVariantRepo.findOne({ where: { id: dto.boxVariantId } });
    if (!variant) {
      throw new NotFoundException('Box variant not found');
    }

    const entry = this.stockEntryRepo.create({
      boxVariantId: dto.boxVariantId,
      quantity: dto.quantity,
      entryDate: dto.entryDate,
      notes: dto.notes || undefined,
      createdBy: userId,
    });

    return this.stockEntryRepo.save(entry);
  }

  async getStockEntries(boxVariantId?: string): Promise<StockEntry[]> {
    const qb = this.stockEntryRepo
      .createQueryBuilder('se')
      .leftJoinAndSelect('se.boxVariant', 'bv')
      .orderBy('se.entry_date', 'DESC');

    if (boxVariantId) {
      qb.where('se.box_variant_id = :boxVariantId', { boxVariantId });
    }

    return qb.getMany();
  }

  async deleteStockEntry(id: string): Promise<void> {
    const entry = await this.stockEntryRepo.findOne({ where: { id } });
    if (!entry) {
      throw new NotFoundException('Stock entry not found');
    }
    await this.stockEntryRepo.remove(entry);
  }

  async getCurrentStockLevels(): Promise<StockLevel[]> {
    // Get all active variants
    const variants = await this.boxVariantRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });

    const levels: StockLevel[] = [];

    for (const variant of variants) {
      // Total added
      const addedResult = await this.stockEntryRepo
        .createQueryBuilder('se')
        .select('COALESCE(SUM(se.quantity), 0)', 'total')
        .where('se.box_variant_id = :variantId', { variantId: variant.id })
        .getRawOne();

      // Total sold
      const soldResult = await this.saleItemRepo
        .createQueryBuilder('si')
        .select('COALESCE(SUM(si.quantity), 0)', 'total')
        .where('si.box_variant_id = :variantId', { variantId: variant.id })
        .getRawOne();

      const totalAdded = parseInt(addedResult.total, 10);
      const totalSold = parseInt(soldResult.total, 10);

      levels.push({
        boxVariantId: variant.id,
        boxVariantName: variant.name,
        piecesPerBox: variant.piecesPerBox,
        totalAdded,
        totalSold,
        currentStock: totalAdded - totalSold,
      });
    }

    return levels;
  }

  async getAvailableStock(boxVariantId: string): Promise<number> {
    const addedResult = await this.stockEntryRepo
      .createQueryBuilder('se')
      .select('COALESCE(SUM(se.quantity), 0)', 'total')
      .where('se.box_variant_id = :boxVariantId', { boxVariantId })
      .getRawOne();

    const soldResult = await this.saleItemRepo
      .createQueryBuilder('si')
      .select('COALESCE(SUM(si.quantity), 0)', 'total')
      .where('si.box_variant_id = :boxVariantId', { boxVariantId })
      .getRawOne();

    return parseInt(addedResult.total, 10) - parseInt(soldResult.total, 10);
  }
}
