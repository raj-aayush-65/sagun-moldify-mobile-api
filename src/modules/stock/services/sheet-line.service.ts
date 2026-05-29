import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SheetLineReport } from '../entities/sheet-line-report.entity';
import { SheetLineMaterialUsage } from '../entities/sheet-line-material-usage.entity';
import { SheetLineMixRatio } from '../entities/sheet-line-mix-ratio.entity';
import { SheetLineWastage } from '../entities/sheet-line-wastage.entity';
import { Roll } from '../entities/roll.entity';
import { RawMaterialType } from '../entities/raw-material-type.entity';
import { RawMaterialPurchase } from '../entities/raw-material-purchase.entity';
import { CreateSheetLineReportDto, UpdateSheetLineReportDto } from '../dto/sheet-line-report.dto';
import { RollStatus } from '../enums/roll-status.enum';

@Injectable()
export class SheetLineService {
  constructor(
    @InjectRepository(SheetLineReport)
    private readonly reportRepo: Repository<SheetLineReport>,
    @InjectRepository(SheetLineMaterialUsage)
    private readonly materialUsageRepo: Repository<SheetLineMaterialUsage>,
    @InjectRepository(SheetLineMixRatio)
    private readonly mixRatioRepo: Repository<SheetLineMixRatio>,
    @InjectRepository(SheetLineWastage)
    private readonly wastageRepo: Repository<SheetLineWastage>,
    @InjectRepository(Roll)
    private readonly rollRepo: Repository<Roll>,
    @InjectRepository(RawMaterialType)
    private readonly materialTypeRepo: Repository<RawMaterialType>,
    @InjectRepository(RawMaterialPurchase)
    private readonly purchaseRepo: Repository<RawMaterialPurchase>,
    private readonly dataSource: DataSource
  ) {}

  async createReport(dto: CreateSheetLineReportDto, userId: string): Promise<any> {
    return this.dataSource.transaction(async manager => {
      // Validate (date, shift) uniqueness
      const existing = await manager.findOne(SheetLineReport, {
        where: { date: dto.date, shift: dto.shift },
      });
      if (existing) {
        throw new ConflictException('SHEET_LINE_REPORT_DUPLICATE');
      }

      // Persist report
      const report = manager.create(SheetLineReport, {
        date: dto.date,
        shift: dto.shift,
        remarks: dto.remarks || undefined,
        reconciliationWarning: false,
        createdBy: userId,
      });
      const savedReport = await manager.save(SheetLineReport, report);

      // Persist materialUsage entries
      const materialUsages: SheetLineMaterialUsage[] = [];
      for (const entry of dto.materialUsage) {
        const usage = manager.create(SheetLineMaterialUsage, {
          sheetLineReportId: savedReport.id,
          materialTypeId: entry.materialTypeId,
          quantityUsed: entry.quantityUsed,
        });
        materialUsages.push(await manager.save(SheetLineMaterialUsage, usage));
      }

      // Persist mixRatio entries (if provided)
      const mixRatios: SheetLineMixRatio[] = [];
      if (dto.mixRatio && dto.mixRatio.length > 0) {
        // Validate sum ≈ 100 (±0.5)
        const sum = dto.mixRatio.reduce((acc, r) => acc + r.proportion, 0);
        if (Math.abs(sum - 100) > 0.5) {
          throw new UnprocessableEntityException('MIX_RATIO_INVALID');
        }

        for (const entry of dto.mixRatio) {
          const ratio = manager.create(SheetLineMixRatio, {
            sheetLineReportId: savedReport.id,
            materialTypeId: entry.materialTypeId,
            proportion: entry.proportion,
          });
          mixRatios.push(await manager.save(SheetLineMixRatio, ratio));
        }
      }

      // Persist wastage entries
      const wastages: SheetLineWastage[] = [];
      if (dto.wastage && dto.wastage.length > 0) {
        for (const entry of dto.wastage) {
          const wastage = manager.create(SheetLineWastage, {
            sheetLineReportId: savedReport.id,
            wastageCategory: entry.wastageCategory,
            weight: entry.weight,
          });
          wastages.push(await manager.save(SheetLineWastage, wastage));
        }
      }

      // Persist rolls (if provided)
      const rolls: Roll[] = [];
      if (dto.rolls && dto.rolls.length > 0) {
        for (const entry of dto.rolls) {
          // Validate grossWeight > coreWeight
          if (entry.grossWeight <= entry.coreWeight) {
            throw new BadRequestException('INVALID_ROLL_WEIGHT');
          }

          // Validate thickness 0.1-10.0
          if (entry.thickness < 0.1 || entry.thickness > 10.0) {
            throw new BadRequestException('INVALID_ROLL_WEIGHT');
          }

          // Validate width 50-2000
          if (entry.width < 50 || entry.width > 2000) {
            throw new BadRequestException('INVALID_ROLL_WEIGHT');
          }

          // Check rollNo unique
          const existingRoll = await manager.findOne(Roll, {
            where: { rollNo: entry.rollNo },
          });
          if (existingRoll) {
            throw new ConflictException('ROLL_NUMBER_DUPLICATE');
          }

          const netWeight = Math.round((entry.grossWeight - entry.coreWeight) * 1000) / 1000;

          const roll = manager.create(Roll, {
            rollNo: entry.rollNo,
            date: dto.date,
            sheetLineReportId: savedReport.id,
            thickness: entry.thickness,
            width: entry.width,
            colour: entry.colour,
            grossWeight: entry.grossWeight,
            coreWeight: entry.coreWeight,
            netWeight,
            status: RollStatus.AVAILABLE,
            createdBy: userId,
          });
          rolls.push(await manager.save(Roll, roll));
        }
      }

      // Compute reconciliation
      const actualMaterialUsed = materialUsages.reduce((acc, u) => acc + Number(u.quantityUsed), 0);
      const actualProduction = rolls.reduce((acc, r) => acc + Number(r.netWeight), 0);
      const wastageTotal = wastages.reduce((acc, w) => acc + Number(w.weight), 0);
      const difference = actualMaterialUsed - actualProduction - wastageTotal;
      // Only show reconciliation warning when rolls ARE produced (if no rolls, it's just material logging)
      const reconciliationWarning =
        actualMaterialUsed > 0 && actualProduction > 0
          ? Math.abs(difference) > 0.02 * actualMaterialUsed
          : false;

      // Update reconciliation warning on report
      savedReport.reconciliationWarning = reconciliationWarning;
      await manager.save(SheetLineReport, savedReport);

      return {
        ...savedReport,
        materialUsages,
        mixRatios,
        wastages,
        rolls,
        reconciliation: {
          actualMaterialUsed: Math.round(actualMaterialUsed * 100) / 100,
          actualProduction: Math.round(actualProduction * 1000) / 1000,
          wastageTotal: Math.round(wastageTotal * 100) / 100,
          difference: Math.round(difference * 100) / 100,
          reconciliationWarning,
        },
      };
    });
  }

  async getReportById(id: string): Promise<any> {
    const report = await this.reportRepo.findOne({
      where: { id },
      relations: [
        'materialUsages',
        'materialUsages.materialType',
        'mixRatios',
        'mixRatios.materialType',
        'wastages',
      ],
    });

    if (!report) {
      throw new NotFoundException('SHEET_LINE_REPORT_NOT_FOUND');
    }

    // Load rolls separately since SheetLineReport doesn't have a direct OneToMany
    const rolls = await this.rollRepo.find({
      where: { sheetLineReportId: id },
      order: { rollNo: 'ASC' },
    });

    return {
      ...report,
      rolls,
    };
  }

  async listReports(filters: {
    dateFrom?: string;
    dateTo?: string;
    shift?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: SheetLineReport[];
    total: number;
    page: number;
    pageSize: number;
    hasNextPage: boolean;
  }> {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;

    const query = this.reportRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.materialUsages', 'mu')
      .leftJoinAndSelect('r.wastages', 'w');

    if (filters.dateFrom) {
      query.andWhere('r.date >= :dateFrom', { dateFrom: filters.dateFrom });
    }

    if (filters.dateTo) {
      query.andWhere('r.date <= :dateTo', { dateTo: filters.dateTo });
    }

    if (filters.shift) {
      query.andWhere('r.shift = :shift', { shift: filters.shift });
    }

    query.orderBy('r.date', 'DESC');
    query.addOrderBy('r.shift', 'ASC');

    const total = await query.getCount();

    query.skip((page - 1) * pageSize);
    query.take(pageSize);

    const items = await query.getMany();

    return {
      items,
      total,
      page,
      pageSize,
      hasNextPage: page * pageSize < total,
    };
  }

  async updateReport(id: string, dto: UpdateSheetLineReportDto, userId: string): Promise<any> {
    return this.dataSource.transaction(async manager => {
      const report = await manager.findOne(SheetLineReport, {
        where: { id },
      });

      if (!report) {
        throw new NotFoundException('SHEET_LINE_REPORT_NOT_FOUND');
      }

      // If date or shift changed, validate uniqueness
      const newDate = dto.date || report.date;
      const newShift = dto.shift || report.shift;
      if (dto.date || dto.shift) {
        const duplicate = await manager.findOne(SheetLineReport, {
          where: { date: newDate, shift: newShift },
        });
        if (duplicate && duplicate.id !== id) {
          throw new ConflictException('SHEET_LINE_REPORT_DUPLICATE');
        }
      }

      // Update report fields
      if (dto.date !== undefined) report.date = dto.date;
      if (dto.shift !== undefined) report.shift = dto.shift;
      if (dto.remarks !== undefined) report.remarks = dto.remarks;
      report.updatedBy = userId;

      // Delete old children if new data provided
      if (dto.materialUsage) {
        await manager.delete(SheetLineMaterialUsage, {
          sheetLineReportId: id,
        });
      }
      if (dto.mixRatio !== undefined) {
        await manager.delete(SheetLineMixRatio, {
          sheetLineReportId: id,
        });
      }
      if (dto.wastage !== undefined) {
        await manager.delete(SheetLineWastage, {
          sheetLineReportId: id,
        });
      }
      if (dto.rolls !== undefined) {
        // Delete old rolls that are AVAILABLE
        await manager.delete(Roll, {
          sheetLineReportId: id,
          status: RollStatus.AVAILABLE,
        });
      }

      // Persist new materialUsage entries
      let materialUsages: SheetLineMaterialUsage[] = [];
      if (dto.materialUsage) {
        for (const entry of dto.materialUsage) {
          const usage = manager.create(SheetLineMaterialUsage, {
            sheetLineReportId: id,
            materialTypeId: entry.materialTypeId,
            quantityUsed: entry.quantityUsed,
          });
          materialUsages.push(await manager.save(SheetLineMaterialUsage, usage));
        }
      } else {
        materialUsages = await manager.find(SheetLineMaterialUsage, {
          where: { sheetLineReportId: id },
        });
      }

      // Persist new mixRatio entries
      let mixRatios: SheetLineMixRatio[] = [];
      if (dto.mixRatio !== undefined) {
        if (dto.mixRatio && dto.mixRatio.length > 0) {
          const sum = dto.mixRatio.reduce((acc, r) => acc + r.proportion, 0);
          if (Math.abs(sum - 100) > 0.5) {
            throw new UnprocessableEntityException('MIX_RATIO_INVALID');
          }

          for (const entry of dto.mixRatio) {
            const ratio = manager.create(SheetLineMixRatio, {
              sheetLineReportId: id,
              materialTypeId: entry.materialTypeId,
              proportion: entry.proportion,
            });
            mixRatios.push(await manager.save(SheetLineMixRatio, ratio));
          }
        }
      } else {
        mixRatios = await manager.find(SheetLineMixRatio, {
          where: { sheetLineReportId: id },
        });
      }

      // Persist new wastage entries
      let wastages: SheetLineWastage[] = [];
      if (dto.wastage !== undefined) {
        if (dto.wastage && dto.wastage.length > 0) {
          for (const entry of dto.wastage) {
            const wastage = manager.create(SheetLineWastage, {
              sheetLineReportId: id,
              wastageCategory: entry.wastageCategory,
              weight: entry.weight,
            });
            wastages.push(await manager.save(SheetLineWastage, wastage));
          }
        }
      } else {
        wastages = await manager.find(SheetLineWastage, {
          where: { sheetLineReportId: id },
        });
      }

      // Persist new rolls
      let rolls: Roll[] = [];
      if (dto.rolls !== undefined) {
        if (dto.rolls && dto.rolls.length > 0) {
          for (const entry of dto.rolls) {
            if (entry.grossWeight <= entry.coreWeight) {
              throw new BadRequestException('INVALID_ROLL_WEIGHT');
            }

            if (entry.thickness < 0.1 || entry.thickness > 10.0) {
              throw new BadRequestException('INVALID_ROLL_WEIGHT');
            }

            if (entry.width < 50 || entry.width > 2000) {
              throw new BadRequestException('INVALID_ROLL_WEIGHT');
            }

            const existingRoll = await manager.findOne(Roll, {
              where: { rollNo: entry.rollNo },
            });
            if (existingRoll && existingRoll.sheetLineReportId !== id) {
              throw new ConflictException('ROLL_NUMBER_DUPLICATE');
            }

            const netWeight = Math.round((entry.grossWeight - entry.coreWeight) * 1000) / 1000;

            const roll = manager.create(Roll, {
              rollNo: entry.rollNo,
              date: newDate,
              sheetLineReportId: id,
              thickness: entry.thickness,
              width: entry.width,
              colour: entry.colour,
              grossWeight: entry.grossWeight,
              coreWeight: entry.coreWeight,
              netWeight,
              status: RollStatus.AVAILABLE,
              createdBy: userId,
            });
            rolls.push(await manager.save(Roll, roll));
          }
        }

        // Also include any non-AVAILABLE rolls that weren't deleted
        const remainingRolls = await manager.find(Roll, {
          where: { sheetLineReportId: id },
        });
        rolls = remainingRolls;
      } else {
        rolls = await manager.find(Roll, {
          where: { sheetLineReportId: id },
        });
      }

      // Recalculate reconciliation
      const actualMaterialUsed = materialUsages.reduce((acc, u) => acc + Number(u.quantityUsed), 0);
      const actualProduction = rolls.reduce((acc, r) => acc + Number(r.netWeight), 0);
      const wastageTotal = wastages.reduce((acc, w) => acc + Number(w.weight), 0);
      const difference = actualMaterialUsed - actualProduction - wastageTotal;
      // Only show reconciliation warning when rolls ARE produced
      const reconciliationWarning =
        actualMaterialUsed > 0 && actualProduction > 0
          ? Math.abs(difference) > 0.02 * actualMaterialUsed
          : false;

      report.reconciliationWarning = reconciliationWarning;
      const savedReport = await manager.save(SheetLineReport, report);

      return {
        ...savedReport,
        materialUsages,
        mixRatios,
        wastages,
        rolls,
        reconciliation: {
          actualMaterialUsed: Math.round(actualMaterialUsed * 100) / 100,
          actualProduction: Math.round(actualProduction * 1000) / 1000,
          wastageTotal: Math.round(wastageTotal * 100) / 100,
          difference: Math.round(difference * 100) / 100,
          reconciliationWarning,
        },
      };
    });
  }

  async deleteReport(id: string): Promise<void> {
    const report = await this.reportRepo.findOne({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('SHEET_LINE_REPORT_NOT_FOUND');
    }

    // Check no rolls are IN_USE or CONSUMED
    const inUseOrConsumedRolls = await this.rollRepo.count({
      where: [
        { sheetLineReportId: id, status: RollStatus.IN_USE },
        { sheetLineReportId: id, status: RollStatus.CONSUMED },
      ],
    });

    if (inUseOrConsumedRolls > 0) {
      throw new ConflictException('Cannot delete report: some rolls are IN_USE or CONSUMED');
    }

    // Delete rolls first (they don't have CASCADE from report side)
    await this.rollRepo.delete({ sheetLineReportId: id });

    // Delete report (children with CASCADE will be auto-deleted)
    await this.reportRepo.remove(report);
  }
}
