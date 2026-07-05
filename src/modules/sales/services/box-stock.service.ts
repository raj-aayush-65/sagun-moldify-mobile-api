import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockEntry } from '../entities/stock-entry.entity';
import { SaleItem } from '../entities/sale-item.entity';
import { BoxVariant } from '../entities/box-variant.entity';
import { Company } from '../entities/company.entity';
import { CreateStockEntryDto } from '../dto/stock-entry.dto';

export interface StockLevel {
  boxVariantId: string;
  boxVariantName: string;
  piecesPerBox: number;
  totalAdded: number;
  totalSold: number;
  currentStock: number;
}

export interface CompanyStockLevel {
  companyId: string;
  companyName: string;
  variants: StockLevel[];
  totalStock: number;
}

@Injectable()
export class BoxStockService {
  constructor(
    @InjectRepository(StockEntry)
    private readonly stockEntryRepo: Repository<StockEntry>,
    @InjectRepository(SaleItem)
    private readonly saleItemRepo: Repository<SaleItem>,
    @InjectRepository(BoxVariant)
    private readonly boxVariantRepo: Repository<BoxVariant>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>
  ) {}

  async addStock(dto: CreateStockEntryDto, userId: string): Promise<StockEntry> {
    // Verify variant exists
    const variant = await this.boxVariantRepo.findOne({ where: { id: dto.boxVariantId } });
    if (!variant) {
      throw new NotFoundException('Box variant not found');
    }

    // Verify company exists if provided
    if (dto.companyId) {
      const company = await this.companyRepo.findOne({ where: { id: dto.companyId } });
      if (!company) {
        throw new NotFoundException('Company not found');
      }
    }

    const entry = this.stockEntryRepo.create({
      boxVariantId: dto.boxVariantId,
      companyId: dto.companyId || undefined,
      quantity: dto.quantity,
      entryDate: dto.entryDate,
      notes: dto.notes || undefined,
      createdBy: userId,
    });

    return this.stockEntryRepo.save(entry);
  }

  async getStockEntries(boxVariantId?: string, companyId?: string): Promise<StockEntry[]> {
    const qb = this.stockEntryRepo
      .createQueryBuilder('se')
      .leftJoinAndSelect('se.boxVariant', 'bv')
      .leftJoinAndSelect('se.company', 'company')
      .orderBy('se.entryDate', 'DESC');

    if (boxVariantId) {
      qb.andWhere('se.boxVariantId = :boxVariantId', { boxVariantId });
    }

    if (companyId) {
      qb.andWhere('se.companyId = :companyId', { companyId });
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

  async getCurrentStockLevels(companyId?: string): Promise<StockLevel[]> {
    // Get all active variants
    const variants = await this.boxVariantRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });

    const levels: StockLevel[] = [];

    for (const variant of variants) {
      // Total added (optionally filtered by company)
      const addedQb = this.stockEntryRepo
        .createQueryBuilder('se')
        .select('COALESCE(SUM(se.quantity), 0)', 'total')
        .where('se.boxVariantId = :variantId', { variantId: variant.id });

      if (companyId) {
        addedQb.andWhere('se.companyId = :companyId', { companyId });
      }

      const addedResult = await addedQb.getRawOne();

      // Total sold (optionally filtered by company via sale.company_id)
      const soldQb = this.saleItemRepo
        .createQueryBuilder('si')
        .select('COALESCE(SUM(si.quantity), 0)', 'total')
        .where('si.boxVariantId = :variantId', { variantId: variant.id });

      if (companyId) {
        soldQb.innerJoin('si.sale', 'sale').andWhere('sale.companyId = :companyId', { companyId });
      }

      const soldResult = await soldQb.getRawOne();

      const totalAdded = parseInt(addedResult?.total || '0', 10);
      const totalSold = parseInt(soldResult?.total || '0', 10);

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

  async getStockLevelsByCompany(): Promise<CompanyStockLevel[]> {
    // Get all active companies
    const companies = await this.companyRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });

    const result: CompanyStockLevel[] = [];

    for (const company of companies) {
      const variants = await this.getCurrentStockLevels(company.id);
      const totalStock = variants.reduce((sum, v) => sum + v.currentStock, 0);

      // Only include companies that have stock activity
      if (variants.some(v => v.totalAdded > 0 || v.totalSold > 0)) {
        result.push({
          companyId: company.id,
          companyName: company.name,
          variants: variants.filter(v => v.totalAdded > 0 || v.totalSold > 0),
          totalStock,
        });
      }
    }

    // Also include "unassigned" stock (entries without company_id)
    const unassignedVariants = await this.getUnassignedStockLevels();
    const unassignedTotal = unassignedVariants.reduce((sum, v) => sum + v.currentStock, 0);

    if (unassignedVariants.some(v => v.totalAdded > 0)) {
      result.push({
        companyId: '',
        companyName: 'Unassigned',
        variants: unassignedVariants.filter(v => v.totalAdded > 0),
        totalStock: unassignedTotal,
      });
    }

    return result;
  }

  private async getUnassignedStockLevels(): Promise<StockLevel[]> {
    const variants = await this.boxVariantRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });

    const levels: StockLevel[] = [];

    for (const variant of variants) {
      // Total added WITHOUT company
      const addedResult = await this.stockEntryRepo
        .createQueryBuilder('se')
        .select('COALESCE(SUM(se.quantity), 0)', 'total')
        .where('se.boxVariantId = :variantId', { variantId: variant.id })
        .andWhere('se.companyId IS NULL')
        .getRawOne();

      const totalAdded = parseInt(addedResult?.total || '0', 10);

      levels.push({
        boxVariantId: variant.id,
        boxVariantName: variant.name,
        piecesPerBox: variant.piecesPerBox,
        totalAdded,
        totalSold: 0, // Unassigned stock has no direct sales tracking
        currentStock: totalAdded,
      });
    }

    return levels;
  }

  async getAvailableStock(boxVariantId: string): Promise<number> {
    const addedResult = await this.stockEntryRepo
      .createQueryBuilder('se')
      .select('COALESCE(SUM(se.quantity), 0)', 'total')
      .where('se.boxVariantId = :boxVariantId', { boxVariantId })
      .getRawOne();

    const soldResult = await this.saleItemRepo
      .createQueryBuilder('si')
      .select('COALESCE(SUM(si.quantity), 0)', 'total')
      .where('si.boxVariantId = :boxVariantId', { boxVariantId })
      .getRawOne();

    return parseInt(addedResult?.total || '0', 10) - parseInt(soldResult?.total || '0', 10);
  }
}
