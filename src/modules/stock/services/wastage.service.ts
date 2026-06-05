import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SheetLineWastage } from '../entities/sheet-line-wastage.entity';
import { TfmRollConsumption } from '../entities/tfm-roll-consumption.entity';
import { Roll } from '../entities/roll.entity';
import { PackingRecord } from '../entities/packing-record.entity';
import { Party } from '../entities/party.entity';
import { Product } from '../entities/product.entity';

@Injectable()
export class WastageService {
  constructor(
    @InjectRepository(SheetLineWastage)
    private readonly sheetLineWastageRepo: Repository<SheetLineWastage>,
    @InjectRepository(TfmRollConsumption)
    private readonly tfmRollConsumptionRepo: Repository<TfmRollConsumption>,
    @InjectRepository(Roll)
    private readonly rollRepo: Repository<Roll>,
    @InjectRepository(PackingRecord)
    private readonly packingRecordRepo: Repository<PackingRecord>,
    @InjectRepository(Party)
    private readonly partyRepo: Repository<Party>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>
  ) {}

  async getWastageSummary(dateFrom?: string, dateTo?: string) {
    // Default to current month (1st to today IST) if no dates provided
    if (!dateFrom || !dateTo) {
      const today = this.getTodayIST();
      const [year, month] = today.split('-');
      dateFrom = `${year}-${month}-01`;
      dateTo = today;
    }

    // Validate dateFrom <= dateTo
    if (dateFrom > dateTo) {
      throw new BadRequestException('INVALID_DATE_RANGE');
    }

    // Query sheet line wastage grouped by wastageCategory within date range
    const sheetLineWastageResults = await this.sheetLineWastageRepo
      .createQueryBuilder('w')
      .select('w.wastage_category', 'category')
      .addSelect('COALESCE(SUM(w.weight), 0)', 'totalWeight')
      .addSelect('COUNT(w.id)', 'entryCount')
      .innerJoin('w.sheetLineReport', 'report')
      .where('report.date >= :dateFrom', { dateFrom })
      .andWhere('report.date <= :dateTo', { dateTo })
      .groupBy('w.wastage_category')
      .getRawMany();

    // Query TFM roll wastage: SUM(tfm_roll_consumption.wastage) within date range
    const tfmWastageResult = await this.tfmRollConsumptionRepo
      .createQueryBuilder('trc')
      .select('COALESCE(SUM(trc.wastage), 0)', 'totalWeight')
      .addSelect('COUNT(trc.id)', 'entryCount')
      .innerJoin('trc.tfmProductionRecord', 'record')
      .where('record.date >= :dateFrom', { dateFrom })
      .andWhere('record.date <= :dateTo', { dateTo })
      .getRawOne();

    // Build categories array
    const categories: Array<{
      category: string;
      totalWeight: number;
      percentage: number;
      entryCount: number;
    }> = [];

    for (const row of sheetLineWastageResults) {
      categories.push({
        category: row.category,
        totalWeight: parseFloat(row.totalWeight),
        percentage: 0, // computed below
        entryCount: parseInt(row.entryCount, 10),
      });
    }

    // Add TFM roll wastage as a category
    const tfmTotalWeight = parseFloat(tfmWastageResult.totalWeight);
    if (tfmTotalWeight > 0 || parseInt(tfmWastageResult.entryCount, 10) > 0) {
      categories.push({
        category: 'TFM_ROLL_WASTAGE',
        totalWeight: tfmTotalWeight,
        percentage: 0,
        entryCount: parseInt(tfmWastageResult.entryCount, 10),
      });
    }

    // Compute totalWastage = sum of all categories
    const totalWastage = categories.reduce((sum, c) => sum + c.totalWeight, 0);

    // Compute totalProduction = SUM(roll.net_weight) WHERE roll.date BETWEEN dateFrom AND dateTo
    const productionResult = await this.rollRepo
      .createQueryBuilder('roll')
      .select('COALESCE(SUM(roll.net_weight), 0)', 'total')
      .where('roll.date >= :dateFrom', { dateFrom })
      .andWhere('roll.date <= :dateTo', { dateTo })
      .getRawOne();
    const totalProduction = parseFloat(productionResult.total);

    // Compute wastagePercentage
    const wastagePercentage =
      totalProduction > 0 ? Math.round((totalWastage / totalProduction) * 100 * 100) / 100 : 0;

    // Per category: percentage = round(categoryTotal / totalWastage * 100, 2)
    for (const cat of categories) {
      cat.percentage =
        totalWastage > 0 ? Math.round((cat.totalWeight / totalWastage) * 100 * 100) / 100 : 0;
    }

    return {
      categories,
      totalWastage,
      totalProduction,
      wastagePercentage,
    };
  }

  async getFinishedGoods(partyId?: string, productId?: string) {
    // Aggregate non-deleted PackingRecords grouped by (partyId, productId)
    const query = this.packingRecordRepo
      .createQueryBuilder('pk')
      .select('pk.party_id', 'partyId')
      .addSelect('pk.product_id', 'productId')
      .addSelect('SUM(pk.box_count)', 'totalBoxes')
      .addSelect('SUM(pk.loose_cups)', 'totalLooseCups')
      .innerJoin('pk.party', 'party')
      .innerJoin('pk.product', 'product')
      .addSelect('party.name', 'partyName')
      .addSelect('product.name', 'productName')
      .addSelect('product.quantity_per_box', 'quantityPerBox')
      .where('pk.deleted_at IS NULL');

    if (partyId) {
      query.andWhere('pk.party_id = :partyId', { partyId });
    }

    if (productId) {
      query.andWhere('pk.product_id = :productId', { productId });
    }

    query
      .groupBy('pk.party_id')
      .addGroupBy('pk.product_id')
      .addGroupBy('party.name')
      .addGroupBy('product.name')
      .addGroupBy('product.quantity_per_box')
      .orderBy('party.name', 'ASC')
      .addOrderBy('product.name', 'ASC');

    const results = await query.getRawMany();

    return results.map(row => {
      const totalBoxes = parseInt(row.totalBoxes, 10);
      const totalLooseCups = parseInt(row.totalLooseCups, 10);
      const quantityPerBox = parseInt(row.quantityPerBox, 10);
      const totalCups = totalBoxes * quantityPerBox + totalLooseCups;

      return {
        partyId: row.partyId,
        partyName: row.partyName,
        productId: row.productId,
        productName: row.productName,
        totalBoxes,
        totalLooseCups,
        totalCups,
      };
    });
  }

  private getTodayIST(): string {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
  }
}
