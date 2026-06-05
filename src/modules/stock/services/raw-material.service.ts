import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { RawMaterialType } from '../entities/raw-material-type.entity';
import { RawMaterialPurchase } from '../entities/raw-material-purchase.entity';
import { SheetLineMaterialUsage } from '../entities/sheet-line-material-usage.entity';
import { CreateRawMaterialTypeDto, UpdateRawMaterialTypeDto } from '../dto/raw-material-type.dto';
import {
  CreateRawMaterialPurchaseDto,
  UpdateRawMaterialPurchaseDto,
} from '../dto/raw-material-purchase.dto';

@Injectable()
export class RawMaterialService {
  constructor(
    @InjectRepository(RawMaterialType)
    private readonly materialTypeRepo: Repository<RawMaterialType>,
    @InjectRepository(RawMaterialPurchase)
    private readonly purchaseRepo: Repository<RawMaterialPurchase>,
    @InjectRepository(SheetLineMaterialUsage)
    private readonly materialUsageRepo: Repository<SheetLineMaterialUsage>
  ) {}

  // ─── Material Type Methods ───────────────────────────────────────────

  async createType(dto: CreateRawMaterialTypeDto, userId: string): Promise<RawMaterialType> {
    const name = dto.name.trim();

    await this.checkDuplicateTypeName(name);

    const materialType = this.materialTypeRepo.create({
      name,
      createdBy: userId,
    });

    return this.materialTypeRepo.save(materialType);
  }

  async updateType(
    id: string,
    dto: UpdateRawMaterialTypeDto,
    userId: string
  ): Promise<RawMaterialType> {
    const materialType = await this.materialTypeRepo.findOne({ where: { id } });
    if (!materialType) {
      throw new NotFoundException('MATERIAL_TYPE_NOT_FOUND');
    }

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      if (trimmedName.toLowerCase() !== materialType.name.toLowerCase()) {
        await this.checkDuplicateTypeName(trimmedName, id);
      }
      materialType.name = trimmedName;
    }

    if (dto.isActive !== undefined) {
      materialType.isActive = dto.isActive;
    }

    materialType.updatedBy = userId;

    return this.materialTypeRepo.save(materialType);
  }

  async deleteType(id: string): Promise<void> {
    const materialType = await this.materialTypeRepo.findOne({ where: { id } });
    if (!materialType) {
      throw new NotFoundException('MATERIAL_TYPE_NOT_FOUND');
    }

    // Check references in RawMaterialPurchase
    const purchaseCount = await this.purchaseRepo.count({
      where: { materialTypeId: id },
    });

    if (purchaseCount > 0) {
      throw new ConflictException('MATERIAL_TYPE_IN_USE');
    }

    // Check references in SheetLineMixRatio
    const mixRatioCount = await this.materialTypeRepo.manager
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('sheet_line_mix_ratio', 'mr')
      .where('mr.material_type_id = :id', { id })
      .getRawOne();

    if (parseInt(mixRatioCount.count, 10) > 0) {
      throw new ConflictException('MATERIAL_TYPE_IN_USE');
    }

    await this.materialTypeRepo.remove(materialType);
  }

  async deactivateType(id: string, userId: string): Promise<RawMaterialType> {
    const materialType = await this.materialTypeRepo.findOne({ where: { id } });
    if (!materialType) {
      throw new NotFoundException('MATERIAL_TYPE_NOT_FOUND');
    }

    materialType.isActive = false;
    materialType.updatedBy = userId;

    return this.materialTypeRepo.save(materialType);
  }

  async listTypes(isActive?: boolean): Promise<RawMaterialType[]> {
    const query = this.materialTypeRepo.createQueryBuilder('mt');

    if (isActive !== undefined) {
      query.where('mt.is_active = :isActive', { isActive });
    }

    query.orderBy('mt.name', 'ASC');

    return query.getMany();
  }

  // ─── Purchase Methods ────────────────────────────────────────────────

  async createPurchase(
    dto: CreateRawMaterialPurchaseDto,
    userId: string
  ): Promise<RawMaterialPurchase> {
    const materialType = await this.materialTypeRepo.findOne({
      where: { id: dto.materialTypeId },
    });

    if (!materialType || !materialType.isActive) {
      throw new BadRequestException('INVALID_MATERIAL_TYPE');
    }

    const totalPrice = Math.round(dto.quantity * dto.pricePerKg * 100) / 100;

    const purchase = this.purchaseRepo.create({
      materialTypeId: dto.materialTypeId,
      vendorName: dto.vendorName,
      quantity: dto.quantity,
      pricePerKg: dto.pricePerKg,
      totalPrice,
      purchaseDate: dto.purchaseDate,
      notes: dto.notes || undefined,
      createdBy: userId,
    });

    return this.purchaseRepo.save(purchase) as Promise<RawMaterialPurchase>;
  }

  async updatePurchase(
    id: string,
    dto: UpdateRawMaterialPurchaseDto,
    userId: string
  ): Promise<RawMaterialPurchase> {
    const purchase = await this.purchaseRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!purchase) {
      throw new NotFoundException('PURCHASE_NOT_FOUND');
    }

    // Validate materialType if changed
    if (dto.materialTypeId !== undefined) {
      const materialType = await this.materialTypeRepo.findOne({
        where: { id: dto.materialTypeId },
      });
      if (!materialType || !materialType.isActive) {
        throw new BadRequestException('INVALID_MATERIAL_TYPE');
      }
      purchase.materialTypeId = dto.materialTypeId;
    }

    // Validate stock won't go negative if quantity decreased
    if (dto.quantity !== undefined && dto.quantity < Number(purchase.quantity)) {
      const quantityDiff = Number(purchase.quantity) - dto.quantity;
      const currentStock = await this.computeAvailableStockForPurchase(purchase);
      if (currentStock - quantityDiff < 0) {
        throw new BadRequestException('QUANTITY_REDUCTION_CAUSES_NEGATIVE_STOCK');
      }
    }

    if (dto.vendorName !== undefined) purchase.vendorName = dto.vendorName;
    if (dto.quantity !== undefined) purchase.quantity = dto.quantity;
    if (dto.pricePerKg !== undefined) purchase.pricePerKg = dto.pricePerKg;
    if (dto.purchaseDate !== undefined) purchase.purchaseDate = dto.purchaseDate;
    if (dto.notes !== undefined) purchase.notes = dto.notes;

    // Recalculate totalPrice if quantity or pricePerKg changed
    if (dto.quantity !== undefined || dto.pricePerKg !== undefined) {
      const quantity = Number(purchase.quantity);
      const pricePerKg = Number(purchase.pricePerKg);
      purchase.totalPrice = Math.round(quantity * pricePerKg * 100) / 100;
    }

    purchase.updatedBy = userId;

    return this.purchaseRepo.save(purchase);
  }

  async deletePurchase(id: string, userId: string): Promise<void> {
    const purchase = await this.purchaseRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!purchase) {
      throw new NotFoundException('PURCHASE_NOT_FOUND');
    }

    purchase.deletedAt = new Date();
    purchase.deletedBy = userId;

    await this.purchaseRepo.save(purchase);
  }

  async listPurchases(filters: {
    materialTypeId?: string;
    vendorName?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: RawMaterialPurchase[];
    total: number;
    page: number;
    pageSize: number;
    hasNextPage: boolean;
  }> {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;

    const query = this.purchaseRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.materialType', 'mt')
      .where('p.deleted_at IS NULL');

    if (filters.materialTypeId) {
      query.andWhere('p.material_type_id = :materialTypeId', {
        materialTypeId: filters.materialTypeId,
      });
    }

    if (filters.vendorName) {
      query.andWhere('p.vendor_name ILIKE :vendorName', {
        vendorName: `%${filters.vendorName}%`,
      });
    }

    if (filters.dateFrom) {
      query.andWhere('p.purchase_date >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
    }

    if (filters.dateTo) {
      query.andWhere('p.purchase_date <= :dateTo', {
        dateTo: filters.dateTo,
      });
    }

    query.orderBy('p.purchase_date', 'DESC');
    query.addOrderBy('p.created_at', 'DESC');

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

  async getPurchaseById(id: string): Promise<RawMaterialPurchase> {
    const purchase = await this.purchaseRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['materialType'],
    });

    if (!purchase) {
      throw new NotFoundException('PURCHASE_NOT_FOUND');
    }

    return purchase;
  }

  // ─── Stock Levels ────────────────────────────────────────────────────

  async getStockLevels(date?: string): Promise<
    Array<{
      materialTypeId: string;
      materialTypeName: string;
      openingStock: number;
      received: number;
      used: number;
      closingStock: number;
      unit: string;
      negativeStock: boolean;
    }>
  > {
    // Default date to today IST
    const targetDate = date || this.getTodayIST();

    // Get all active material types
    const materialTypes = await this.materialTypeRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });

    const results = await Promise.all(
      materialTypes.map(async mt => {
        // Opening stock = purchases before date - usage before date
        const purchasedBefore = await this.purchaseRepo
          .createQueryBuilder('p')
          .select('COALESCE(SUM(p.quantity), 0)', 'total')
          .where('p.material_type_id = :materialTypeId', {
            materialTypeId: mt.id,
          })
          .andWhere('p.purchase_date < :date', { date: targetDate })
          .andWhere('p.deleted_at IS NULL')
          .getRawOne();

        const usedBefore = await this.materialUsageRepo
          .createQueryBuilder('mu')
          .select('COALESCE(SUM(mu.quantity_used), 0)', 'total')
          .innerJoin('mu.sheetLineReport', 'report')
          .where('mu.material_type_id = :materialTypeId', {
            materialTypeId: mt.id,
          })
          .andWhere('report.date < :date', { date: targetDate })
          .getRawOne();

        const openingStock = parseFloat(purchasedBefore.total) - parseFloat(usedBefore.total);

        // Received = purchases on date
        const receivedResult = await this.purchaseRepo
          .createQueryBuilder('p')
          .select('COALESCE(SUM(p.quantity), 0)', 'total')
          .where('p.material_type_id = :materialTypeId', {
            materialTypeId: mt.id,
          })
          .andWhere('p.purchase_date = :date', { date: targetDate })
          .andWhere('p.deleted_at IS NULL')
          .getRawOne();

        const received = parseFloat(receivedResult.total);

        // Used = usage on date
        const usedResult = await this.materialUsageRepo
          .createQueryBuilder('mu')
          .select('COALESCE(SUM(mu.quantity_used), 0)', 'total')
          .innerJoin('mu.sheetLineReport', 'report')
          .where('mu.material_type_id = :materialTypeId', {
            materialTypeId: mt.id,
          })
          .andWhere('report.date = :date', { date: targetDate })
          .getRawOne();

        const used = parseFloat(usedResult.total);

        const closingStock = openingStock + received - used;

        return {
          materialTypeId: mt.id,
          materialTypeName: mt.name,
          openingStock: Math.round(openingStock * 1000) / 1000,
          received: Math.round(received * 1000) / 1000,
          used: Math.round(used * 1000) / 1000,
          closingStock: Math.round(closingStock * 1000) / 1000,
          unit: 'kg',
          negativeStock: closingStock < 0,
        };
      })
    );

    return results;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────

  private async checkDuplicateTypeName(name: string, excludeId?: string): Promise<void> {
    const query = this.materialTypeRepo
      .createQueryBuilder('mt')
      .where('LOWER(mt.name) = LOWER(:name)', { name });

    if (excludeId) {
      query.andWhere('mt.id != :excludeId', { excludeId });
    }

    const existing = await query.getOne();

    if (existing) {
      throw new ConflictException('MATERIAL_TYPE_ALREADY_EXISTS');
    }
  }

  private async computeAvailableStockForPurchase(purchase: RawMaterialPurchase): Promise<number> {
    // Compute total purchased for this material type
    const totalPurchased = await this.purchaseRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.quantity), 0)', 'total')
      .where('p.material_type_id = :materialTypeId', {
        materialTypeId: purchase.materialTypeId,
      })
      .andWhere('p.deleted_at IS NULL')
      .getRawOne();

    // Compute total used for this material type
    const totalUsed = await this.materialUsageRepo
      .createQueryBuilder('mu')
      .select('COALESCE(SUM(mu.quantity_used), 0)', 'total')
      .where('mu.material_type_id = :materialTypeId', {
        materialTypeId: purchase.materialTypeId,
      })
      .getRawOne();

    return parseFloat(totalPurchased.total) - parseFloat(totalUsed.total);
  }

  private getTodayIST(): string {
    const now = new Date();
    // IST is UTC+5:30
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
  }
}
