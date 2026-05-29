import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TfmProductionRecord } from '../entities/tfm-production-record.entity';
import { TfmRollConsumption } from '../entities/tfm-roll-consumption.entity';
import { TfmProductionOutput } from '../entities/tfm-production-output.entity';
import { Roll } from '../entities/roll.entity';
import { Product } from '../entities/product.entity';
import { RollStatus } from '../enums/roll-status.enum';
import { CreateTfmProductionDto, UpdateTfmProductionDto } from '../dto/tfm-production.dto';

@Injectable()
export class TfmService {
  constructor(
    @InjectRepository(TfmProductionRecord)
    private readonly recordRepo: Repository<TfmProductionRecord>,
    @InjectRepository(TfmRollConsumption)
    private readonly rollConsumptionRepo: Repository<TfmRollConsumption>,
    @InjectRepository(TfmProductionOutput)
    private readonly productionOutputRepo: Repository<TfmProductionOutput>,
    @InjectRepository(Roll)
    private readonly rollRepo: Repository<Roll>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly dataSource: DataSource
  ) {}

  // ─── Create Record ───────────────────────────────────────────────────

  async createRecord(dto: CreateTfmProductionDto, userId: string): Promise<TfmProductionRecord> {
    return this.dataSource.transaction<TfmProductionRecord>(async manager => {
      // Validate (date, shift) uniqueness
      const existing = await manager.findOne(TfmProductionRecord, {
        where: { date: dto.date, shift: dto.shift },
      });
      if (existing) {
        throw new ConflictException('TFM_RECORD_DUPLICATE');
      }

      // Create the production record
      const record = manager.create(TfmProductionRecord, {
        date: dto.date,
        shift: dto.shift,
        createdBy: userId,
      });
      const savedRecord = await manager.save(TfmProductionRecord, record);

      // Process roll consumptions
      for (const rc of dto.rollConsumptions) {
        const roll = await manager.findOne(Roll, { where: { id: rc.rollId } });
        if (!roll) {
          throw new BadRequestException('INVALID_ROLL');
        }
        if (roll.status === RollStatus.CONSUMED) {
          throw new BadRequestException('ROLL_ALREADY_CONSUMED');
        }

        // Check weight mismatch
        const weightMismatch = Math.abs(rc.rollWeight - Number(roll.netWeight)) > 0.5;

        // Create roll consumption entry
        const consumption = manager.create(TfmRollConsumption, {
          tfmProductionRecordId: savedRecord.id,
          rollId: rc.rollId,
          rollWeight: rc.rollWeight,
          wastage: rc.wastage,
          shiftEndStatus: rc.shiftEndStatus,
          remainingWeight: rc.remainingWeight || undefined,
          weightMismatch,
          remarks: rc.remarks || undefined,
        } as Partial<TfmRollConsumption>);
        await manager.save(TfmRollConsumption, consumption);

        // Update roll status based on shiftEndStatus
        if (rc.shiftEndStatus === 'FULLY_USED') {
          roll.status = RollStatus.CONSUMED;
        } else if (rc.shiftEndStatus === 'PARTIALLY_USED') {
          roll.status = RollStatus.IN_USE;
        }
        // REMAINING → keep AVAILABLE, no change needed
        await manager.save(Roll, roll);
      }

      // Process production outputs
      for (const po of dto.productionOutputs) {
        const product = await manager.findOne(Product, {
          where: { id: po.productId },
        });
        if (!product || !product.isActive) {
          throw new BadRequestException('INVALID_PRODUCT');
        }

        const totalBoxes = Math.floor(po.quantity / product.quantityPerBox);
        const looseCups = (po.quantity % product.quantityPerBox) + (po.looseCount || 0);

        const output = manager.create(TfmProductionOutput, {
          tfmProductionRecordId: savedRecord.id,
          productId: po.productId,
          quantity: po.quantity,
          looseCount: po.looseCount || 0,
          totalBoxes,
          looseCups,
        } as Partial<TfmProductionOutput>);
        await manager.save(TfmProductionOutput, output);
      }

      // Return full record with children
      const result = await manager.findOne(TfmProductionRecord, {
        where: { id: savedRecord.id },
        relations: [
          'rollConsumptions',
          'rollConsumptions.roll',
          'productionOutputs',
          'productionOutputs.product',
        ],
      });

      return result!;
    });
  }

  // ─── Get Record By ID ────────────────────────────────────────────────

  async getRecordById(id: string): Promise<TfmProductionRecord> {
    const record = await this.recordRepo.findOne({
      where: { id },
      relations: [
        'rollConsumptions',
        'rollConsumptions.roll',
        'productionOutputs',
        'productionOutputs.product',
      ],
    });

    if (!record) {
      throw new NotFoundException('TFM_RECORD_NOT_FOUND');
    }

    return record;
  }

  // ─── List Records ────────────────────────────────────────────────────

  async listRecords(filters: {
    dateFrom?: string;
    dateTo?: string;
    shift?: string;
    rollId?: string;
    productId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: TfmProductionRecord[];
    total: number;
    page: number;
    pageSize: number;
    hasNextPage: boolean;
  }> {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;

    const query = this.recordRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.rollConsumptions', 'rc')
      .leftJoinAndSelect('rc.roll', 'roll')
      .leftJoinAndSelect('r.productionOutputs', 'po')
      .leftJoinAndSelect('po.product', 'product');

    if (filters.dateFrom) {
      query.andWhere('r.date >= :dateFrom', { dateFrom: filters.dateFrom });
    }

    if (filters.dateTo) {
      query.andWhere('r.date <= :dateTo', { dateTo: filters.dateTo });
    }

    if (filters.shift) {
      query.andWhere('r.shift = :shift', { shift: filters.shift });
    }

    if (filters.rollId) {
      query.andWhere('rc.roll_id = :rollId', { rollId: filters.rollId });
    }

    if (filters.productId) {
      query.andWhere('po.product_id = :productId', {
        productId: filters.productId,
      });
    }

    query.orderBy('r.date', 'DESC');
    query.addOrderBy('r.shift', 'DESC');

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

  // ─── Update Record ───────────────────────────────────────────────────

  async updateRecord(
    id: string,
    dto: UpdateTfmProductionDto,
    userId: string
  ): Promise<TfmProductionRecord> {
    return this.dataSource.transaction<TfmProductionRecord>(async manager => {
      const record = await manager.findOne(TfmProductionRecord, {
        where: { id },
        relations: ['rollConsumptions', 'productionOutputs'],
      });

      if (!record) {
        throw new NotFoundException('TFM_RECORD_NOT_FOUND');
      }

      // Check uniqueness if date or shift is changing
      if (dto.date || dto.shift) {
        const newDate = dto.date || record.date;
        const newShift = dto.shift || record.shift;

        if (newDate !== record.date || newShift !== record.shift) {
          const duplicate = await manager.findOne(TfmProductionRecord, {
            where: { date: newDate, shift: newShift },
          });
          if (duplicate && duplicate.id !== id) {
            throw new ConflictException('TFM_RECORD_DUPLICATE');
          }
        }
      }

      // Reverse prior roll status changes (set rolls back to AVAILABLE)
      for (const rc of record.rollConsumptions) {
        await manager.update(Roll, rc.rollId, {
          status: RollStatus.AVAILABLE,
        });
      }

      // Delete old children
      await manager.delete(TfmRollConsumption, {
        tfmProductionRecordId: id,
      });
      await manager.delete(TfmProductionOutput, {
        tfmProductionRecordId: id,
      });

      // Update record fields
      if (dto.date) record.date = dto.date;
      if (dto.shift) record.shift = dto.shift;
      record.updatedBy = userId;
      await manager.save(TfmProductionRecord, record);

      // Reapply roll consumptions
      if (dto.rollConsumptions) {
        for (const rc of dto.rollConsumptions) {
          const roll = await manager.findOne(Roll, {
            where: { id: rc.rollId },
          });
          if (!roll) {
            throw new BadRequestException('INVALID_ROLL');
          }
          if (roll.status === RollStatus.CONSUMED) {
            throw new BadRequestException('ROLL_ALREADY_CONSUMED');
          }

          const weightMismatch = Math.abs(rc.rollWeight - Number(roll.netWeight)) > 0.5;

          const consumption = manager.create(TfmRollConsumption, {
            tfmProductionRecordId: id,
            rollId: rc.rollId,
            rollWeight: rc.rollWeight,
            wastage: rc.wastage,
            shiftEndStatus: rc.shiftEndStatus,
            remainingWeight: rc.remainingWeight || undefined,
            weightMismatch,
            remarks: rc.remarks || undefined,
          } as Partial<TfmRollConsumption>);
          await manager.save(TfmRollConsumption, consumption);

          // Update roll status
          if (rc.shiftEndStatus === 'FULLY_USED') {
            roll.status = RollStatus.CONSUMED;
          } else if (rc.shiftEndStatus === 'PARTIALLY_USED') {
            roll.status = RollStatus.IN_USE;
          }
          await manager.save(Roll, roll);
        }
      }

      // Reapply production outputs
      if (dto.productionOutputs) {
        for (const po of dto.productionOutputs) {
          const product = await manager.findOne(Product, {
            where: { id: po.productId },
          });
          if (!product || !product.isActive) {
            throw new BadRequestException('INVALID_PRODUCT');
          }

          const totalBoxes = Math.floor(po.quantity / product.quantityPerBox);
          const looseCups = (po.quantity % product.quantityPerBox) + (po.looseCount || 0);

          const output = manager.create(TfmProductionOutput, {
            tfmProductionRecordId: id,
            productId: po.productId,
            quantity: po.quantity,
            looseCount: po.looseCount || 0,
            totalBoxes,
            looseCups,
          } as Partial<TfmProductionOutput>);
          await manager.save(TfmProductionOutput, output);
        }
      }

      // Return full record with children
      const result = await manager.findOne(TfmProductionRecord, {
        where: { id },
        relations: [
          'rollConsumptions',
          'rollConsumptions.roll',
          'productionOutputs',
          'productionOutputs.product',
        ],
      });

      return result!;
    });
  }

  // ─── Delete Record ───────────────────────────────────────────────────

  async deleteRecord(id: string): Promise<void> {
    return this.dataSource.transaction(async manager => {
      const record = await manager.findOne(TfmProductionRecord, {
        where: { id },
        relations: ['rollConsumptions'],
      });

      if (!record) {
        throw new NotFoundException('TFM_RECORD_NOT_FOUND');
      }

      // Reverse roll status changes (set rolls back to AVAILABLE)
      for (const rc of record.rollConsumptions) {
        await manager.update(Roll, rc.rollId, {
          status: RollStatus.AVAILABLE,
        });
      }

      // Delete cascade (children will be deleted via CASCADE)
      await manager.remove(TfmProductionRecord, record);
    });
  }
}
