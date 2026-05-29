import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roll } from '../entities/roll.entity';
import { TfmProductionOutput } from '../entities/tfm-production-output.entity';
import { PrintingRecord } from '../entities/printing-record.entity';
import { PackingRecord } from '../entities/packing-record.entity';
import { RawMaterialService } from './raw-material.service';

@Injectable()
export class StockDashboardService {
  constructor(
    private readonly rawMaterialService: RawMaterialService,
    @InjectRepository(Roll)
    private readonly rollRepo: Repository<Roll>,
    @InjectRepository(TfmProductionOutput)
    private readonly tfmOutputRepo: Repository<TfmProductionOutput>,
    @InjectRepository(PrintingRecord)
    private readonly printingRepo: Repository<PrintingRecord>,
    @InjectRepository(PackingRecord)
    private readonly packingRepo: Repository<PackingRecord>
  ) {}

  async getDashboard(date?: string) {
    const targetDate = date || this.getTodayIST();

    // Raw material stock levels
    const stockLevels = await this.rawMaterialService.getStockLevels(targetDate);
    const rawMaterialStock = stockLevels.map(level => ({
      materialTypeName: level.materialTypeName,
      closingStock: level.closingStock,
    }));

    // Sheet line output: SUM of material used on that date (from sheet_line_material_usage joined with sheet_line_report)
    // This shows total material processed through the sheet line, regardless of whether rolls were logged
    const sheetLineResult = await this.rollRepo.manager
      .createQueryBuilder()
      .select('COALESCE(SUM(mu.quantity_used), 0)', 'total')
      .from('sheet_line_material_usage', 'mu')
      .innerJoin('sheet_line_report', 'r', 'r.id = mu.sheet_line_report_id')
      .where('r.date = :date', { date: targetDate })
      .getRawOne();
    const sheetLineOutput = parseFloat(sheetLineResult.total);

    // TFM output: SUM(tfm_production_output.quantity) via join with tfm_production_record WHERE record.date = date
    const tfmResult = await this.tfmOutputRepo
      .createQueryBuilder('output')
      .select('COALESCE(SUM(output.quantity), 0)', 'total')
      .innerJoin('output.tfmProductionRecord', 'record')
      .where('record.date = :date', { date: targetDate })
      .getRawOne();
    const tfmOutput = parseInt(tfmResult.total, 10);

    // Printing output: SUM(printing_record.quantity) WHERE date = date AND deleted_at IS NULL
    const printingResult = await this.printingRepo
      .createQueryBuilder('pr')
      .select('COALESCE(SUM(pr.quantity), 0)', 'total')
      .where('pr.date = :date', { date: targetDate })
      .andWhere('pr.deleted_at IS NULL')
      .getRawOne();
    const printingOutput = parseInt(printingResult.total, 10);

    // Packing output: SUM(packing_record.box_count) WHERE date = date AND deleted_at IS NULL
    const packingResult = await this.packingRepo
      .createQueryBuilder('pk')
      .select('COALESCE(SUM(pk.box_count), 0)', 'total')
      .where('pk.date = :date', { date: targetDate })
      .andWhere('pk.deleted_at IS NULL')
      .getRawOne();
    const packingOutput = parseInt(packingResult.total, 10);

    return {
      date: targetDate,
      rawMaterialStock,
      sheetLineOutput,
      tfmOutput,
      printingOutput,
      packingOutput,
    };
  }

  private getTodayIST(): string {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
  }
}
