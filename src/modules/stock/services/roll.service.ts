import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roll } from '../entities/roll.entity';
import { SheetLineReport } from '../entities/sheet-line-report.entity';
import { TfmRollConsumption } from '../entities/tfm-roll-consumption.entity';
import { CreateRollDto, UpdateRollDto } from '../dto/roll.dto';
import { RollStatus } from '../enums/roll-status.enum';

@Injectable()
export class RollService {
  constructor(
    @InjectRepository(Roll)
    private readonly rollRepo: Repository<Roll>,
    @InjectRepository(SheetLineReport)
    private readonly sheetLineReportRepo: Repository<SheetLineReport>,
    @InjectRepository(TfmRollConsumption)
    private readonly tfmRollConsumptionRepo: Repository<TfmRollConsumption>
  ) {}

  // ─── Create ──────────────────────────────────────────────────────────

  async create(dto: CreateRollDto, userId: string): Promise<Roll> {
    // Validate sheetLineReportId exists
    const report = await this.sheetLineReportRepo.findOne({
      where: { id: dto.sheetLineReportId },
    });
    if (!report) {
      throw new BadRequestException('INVALID_SHEET_LINE_REPORT');
    }

    // Validate rollNo unique
    const existingRoll = await this.rollRepo.findOne({
      where: { rollNo: dto.rollNo },
    });
    if (existingRoll) {
      throw new ConflictException('ROLL_NUMBER_DUPLICATE');
    }

    // Validate grossWeight > coreWeight
    if (dto.grossWeight <= dto.coreWeight) {
      throw new BadRequestException('INVALID_ROLL_WEIGHT');
    }

    // Validate thickness 0.1-10.0
    if (dto.thickness < 0.1 || dto.thickness > 10.0) {
      throw new BadRequestException('INVALID_THICKNESS');
    }

    // Validate width 50-2000
    if (dto.width < 50 || dto.width > 2000) {
      throw new BadRequestException('INVALID_WIDTH');
    }

    // Compute netWeight
    const netWeight = Math.round((Number(dto.grossWeight) - Number(dto.coreWeight)) * 1000) / 1000;

    const roll = this.rollRepo.create({
      rollNo: dto.rollNo,
      date: dto.date,
      sheetLineReportId: dto.sheetLineReportId,
      thickness: dto.thickness,
      width: dto.width,
      colour: dto.colour,
      grossWeight: dto.grossWeight,
      coreWeight: dto.coreWeight,
      netWeight,
      status: RollStatus.AVAILABLE,
      createdBy: userId,
    });

    return this.rollRepo.save(roll);
  }

  // ─── Update ──────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateRollDto, userId: string): Promise<Roll> {
    const roll = await this.rollRepo.findOne({ where: { id } });
    if (!roll) {
      throw new NotFoundException('ROLL_NOT_FOUND');
    }

    // Validate status is AVAILABLE
    if (roll.status !== RollStatus.AVAILABLE) {
      throw new ConflictException('ROLL_NOT_MODIFIABLE');
    }

    // Validate sheetLineReportId if provided
    if (dto.sheetLineReportId !== undefined) {
      const report = await this.sheetLineReportRepo.findOne({
        where: { id: dto.sheetLineReportId },
      });
      if (!report) {
        throw new BadRequestException('INVALID_SHEET_LINE_REPORT');
      }
      roll.sheetLineReportId = dto.sheetLineReportId;
    }

    // Validate rollNo unique if changed
    if (dto.rollNo !== undefined && dto.rollNo !== roll.rollNo) {
      const existingRoll = await this.rollRepo.findOne({
        where: { rollNo: dto.rollNo },
      });
      if (existingRoll) {
        throw new ConflictException('ROLL_NUMBER_DUPLICATE');
      }
      roll.rollNo = dto.rollNo;
    }

    if (dto.date !== undefined) roll.date = dto.date;
    if (dto.thickness !== undefined) roll.thickness = dto.thickness;
    if (dto.width !== undefined) roll.width = dto.width;
    if (dto.colour !== undefined) roll.colour = dto.colour;
    if (dto.grossWeight !== undefined) roll.grossWeight = dto.grossWeight;
    if (dto.coreWeight !== undefined) roll.coreWeight = dto.coreWeight;

    // Apply validations on final values
    const grossWeight = Number(roll.grossWeight);
    const coreWeight = Number(roll.coreWeight);

    if (grossWeight <= coreWeight) {
      throw new BadRequestException('INVALID_ROLL_WEIGHT');
    }

    if (roll.thickness < 0.1 || roll.thickness > 10.0) {
      throw new BadRequestException('INVALID_THICKNESS');
    }

    if (roll.width < 50 || roll.width > 2000) {
      throw new BadRequestException('INVALID_WIDTH');
    }

    // Recalculate netWeight
    roll.netWeight = Math.round((grossWeight - coreWeight) * 1000) / 1000;

    roll.updatedBy = userId;

    return this.rollRepo.save(roll);
  }

  // ─── Delete ──────────────────────────────────────────────────────────

  async delete(id: string): Promise<void> {
    const roll = await this.rollRepo.findOne({ where: { id } });
    if (!roll) {
      throw new NotFoundException('ROLL_NOT_FOUND');
    }

    // Validate status AVAILABLE
    if (roll.status !== RollStatus.AVAILABLE) {
      throw new ConflictException('ROLL_NOT_MODIFIABLE');
    }

    // Check no TFM references
    const tfmCount = await this.tfmRollConsumptionRepo.count({
      where: { rollId: id },
    });
    if (tfmCount > 0) {
      throw new ConflictException('ROLL_IN_USE');
    }

    await this.rollRepo.remove(roll);
  }

  // ─── List ────────────────────────────────────────────────────────────

  async list(filters: {
    dateFrom?: string;
    dateTo?: string;
    colour?: string;
    status?: RollStatus;
    sheetLineReportId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: Roll[];
    total: number;
    page: number;
    pageSize: number;
    hasNextPage: boolean;
  }> {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;

    const query = this.rollRepo.createQueryBuilder('r');

    if (filters.dateFrom) {
      query.andWhere('r.date >= :dateFrom', { dateFrom: filters.dateFrom });
    }

    if (filters.dateTo) {
      query.andWhere('r.date <= :dateTo', { dateTo: filters.dateTo });
    }

    if (filters.colour) {
      query.andWhere('r.colour ILIKE :colour', {
        colour: `%${filters.colour}%`,
      });
    }

    if (filters.status) {
      query.andWhere('r.status = :status', { status: filters.status });
    }

    if (filters.sheetLineReportId) {
      query.andWhere('r.sheet_line_report_id = :sheetLineReportId', {
        sheetLineReportId: filters.sheetLineReportId,
      });
    }

    query.orderBy('r.date', 'DESC');
    query.addOrderBy('r.roll_no', 'ASC');

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

  // ─── Find By ID ─────────────────────────────────────────────────────

  async findById(id: string): Promise<Roll> {
    const roll = await this.rollRepo.findOne({
      where: { id },
      relations: ['sheetLineReport'],
    });

    if (!roll) {
      throw new NotFoundException('ROLL_NOT_FOUND');
    }

    return roll;
  }

  // ─── Get Trace ───────────────────────────────────────────────────────

  async getTrace(id: string): Promise<{
    roll: {
      id: string;
      rollNo: string;
      thickness: number;
      width: number;
      colour: string;
      grossWeight: number;
      coreWeight: number;
      netWeight: number;
      status: RollStatus;
    };
    sheetLineOrigin: {
      id: string;
      date: string;
      shift: string;
      mixRatios: Array<{
        materialTypeName: string;
        proportion: number;
      }>;
    };
    tfmConsumption: Array<{
      id: string;
      date: string;
      shift: string;
      wastage: number;
      shiftEndStatus: string;
      remarks: string | null;
    }>;
    cupsProduced: Array<{
      productName: string;
      quantity: number;
    }>;
  }> {
    // Fetch roll with sheetLineReport and its mixRatios (with materialType)
    const roll = await this.rollRepo
      .createQueryBuilder('roll')
      .leftJoinAndSelect('roll.sheetLineReport', 'report')
      .leftJoinAndSelect('report.mixRatios', 'mixRatio')
      .leftJoinAndSelect('mixRatio.materialType', 'mt')
      .where('roll.id = :id', { id })
      .getOne();

    if (!roll) {
      throw new NotFoundException('ROLL_NOT_FOUND');
    }

    // Fetch TFM consumptions for this roll
    const tfmConsumptions = await this.tfmRollConsumptionRepo
      .createQueryBuilder('consumption')
      .leftJoinAndSelect('consumption.tfmProductionRecord', 'record')
      .where('consumption.roll_id = :rollId', { rollId: id })
      .orderBy('record.date', 'DESC')
      .getMany();

    // Fetch cups produced from TFM production outputs linked to the same TFM records
    const tfmRecordIds = tfmConsumptions.map(c => c.tfmProductionRecordId);

    let cupsProduced: Array<{ productName: string; quantity: number }> = [];

    if (tfmRecordIds.length > 0) {
      const outputs = await this.rollRepo.manager
        .createQueryBuilder()
        .select('product.name', 'productName')
        .addSelect('SUM(output.quantity)', 'quantity')
        .from('tfm_production_output', 'output')
        .innerJoin('product', 'product', 'product.id = output.product_id')
        .where('output.tfm_production_record_id IN (:...tfmRecordIds)', {
          tfmRecordIds,
        })
        .groupBy('product.name')
        .getRawMany();

      cupsProduced = outputs.map(o => ({
        productName: o.productName,
        quantity: parseInt(o.quantity, 10),
      }));
    }

    // Build sheetLineOrigin with mix ratios
    const sheetLineOrigin = {
      id: roll.sheetLineReport.id,
      date: roll.sheetLineReport.date,
      shift: roll.sheetLineReport.shift,
      mixRatios: (roll.sheetLineReport.mixRatios || []).map(mr => ({
        materialTypeName: mr.materialType?.name || '',
        proportion: Number(mr.proportion),
      })),
    };

    // Build tfmConsumption response
    const tfmConsumptionResponse = tfmConsumptions.map(c => ({
      id: c.id,
      date: c.tfmProductionRecord.date,
      shift: c.tfmProductionRecord.shift,
      wastage: Number(c.wastage),
      shiftEndStatus: c.shiftEndStatus,
      remarks: c.remarks || null,
    }));

    return {
      roll: {
        id: roll.id,
        rollNo: roll.rollNo,
        thickness: Number(roll.thickness),
        width: Number(roll.width),
        colour: roll.colour,
        grossWeight: Number(roll.grossWeight),
        coreWeight: Number(roll.coreWeight),
        netWeight: Number(roll.netWeight),
        status: roll.status,
      },
      sheetLineOrigin,
      tfmConsumption: tfmConsumptionResponse,
      cupsProduced,
    };
  }
}
