import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Sale } from '../entities/sale.entity';
import { SaleItem } from '../entities/sale-item.entity';
import { Company } from '../entities/company.entity';
import { BoxVariant } from '../entities/box-variant.entity';
import { CreateSaleDto, UpdateSalePaymentDto } from '../dto/sale.dto';
import { PaymentStatus } from '../enums/payment-status.enum';
import { BoxStockService } from './box-stock.service';

export interface SalesSummary {
  todaySales: number;
  todayBoxesSold: number;
  monthlySales: number;
  monthlyBoxesSold: number;
}

@Injectable()
export class SaleService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly saleItemRepo: Repository<SaleItem>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(BoxVariant)
    private readonly boxVariantRepo: Repository<BoxVariant>,
    private readonly dataSource: DataSource,
    private readonly boxStockService: BoxStockService
  ) {}

  async create(dto: CreateSaleDto, userId: string): Promise<Sale> {
    // Validate company
    const company = await this.companyRepo.findOne({ where: { id: dto.companyId } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Validate stock availability for each item
    for (const item of dto.items) {
      const variant = await this.boxVariantRepo.findOne({ where: { id: item.boxVariantId } });
      if (!variant) {
        throw new NotFoundException(`Box variant not found: ${item.boxVariantId}`);
      }

      const available = await this.boxStockService.getAvailableStock(item.boxVariantId);
      if (available < item.quantity) {
        throw new HttpException(
          {
            status: 'error',
            message: `Insufficient stock for "${variant.name}". Available: ${available}, Requested: ${item.quantity}`,
            data: { code: 'INSUFFICIENT_STOCK', variantId: item.boxVariantId, available },
          },
          HttpStatus.BAD_REQUEST
        );
      }
    }

    // Calculate total if prices provided
    let totalAmount = dto.totalAmount;
    if (!totalAmount) {
      const computed = dto.items.reduce((sum, item) => {
        return sum + (item.pricePerBox ? item.pricePerBox * item.quantity : 0);
      }, 0);
      if (computed > 0) totalAmount = computed;
    }

    // Create sale with items
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const sale = queryRunner.manager.create(Sale, {
        companyId: dto.companyId,
        saleDate: dto.saleDate,
        buyerName: dto.buyerName || undefined,
        deliveryAddress: dto.deliveryAddress || undefined,
        paymentStatus: dto.paymentStatus || PaymentStatus.PENDING,
        totalAmount: totalAmount || undefined,
        notes: dto.notes || undefined,
        createdBy: userId,
      });

      const savedSale = await queryRunner.manager.save(Sale, sale);

      // Create sale items
      const items = dto.items.map(item =>
        queryRunner.manager.create(SaleItem, {
          saleId: savedSale.id,
          boxVariantId: item.boxVariantId,
          quantity: item.quantity,
          pricePerBox: item.pricePerBox || undefined,
        })
      );

      await queryRunner.manager.save(SaleItem, items);
      await queryRunner.commitTransaction();

      // Return full sale with relations
      return this.findById(savedSale.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updatePayment(id: string, dto: UpdateSalePaymentDto, userId: string): Promise<Sale> {
    const sale = await this.findById(id);
    sale.paymentStatus = dto.paymentStatus;
    if (dto.totalAmount !== undefined) sale.totalAmount = dto.totalAmount;
    sale.updatedBy = userId;
    return this.saleRepo.save(sale);
  }

  async findAll(filters?: {
    companyId?: string;
    paymentStatus?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: Sale[];
    total: number;
    page: number;
    pageSize: number;
    hasNextPage: boolean;
  }> {
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters?.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;

    const qb = this.saleRepo
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.company', 'company')
      .leftJoinAndSelect('sale.items', 'items')
      .leftJoinAndSelect('items.boxVariant', 'boxVariant');

    if (filters?.companyId) {
      qb.andWhere('sale.company_id = :companyId', { companyId: filters.companyId });
    }

    if (filters?.paymentStatus) {
      qb.andWhere('sale.payment_status = :paymentStatus', {
        paymentStatus: filters.paymentStatus,
      });
    }

    if (filters?.dateFrom) {
      qb.andWhere('sale.sale_date >= :dateFrom', { dateFrom: filters.dateFrom });
    }

    if (filters?.dateTo) {
      qb.andWhere('sale.sale_date <= :dateTo', { dateTo: filters.dateTo });
    }

    qb.orderBy('sale.sale_date', 'DESC');
    qb.addOrderBy('sale.created_at', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return { items, total, page, pageSize, hasNextPage: page * pageSize < total };
  }

  async findById(id: string): Promise<Sale> {
    const sale = await this.saleRepo.findOne({
      where: { id },
      relations: ['company', 'items', 'items.boxVariant'],
    });
    if (!sale) {
      throw new NotFoundException('Sale not found');
    }
    return sale;
  }

  async delete(id: string): Promise<void> {
    const sale = await this.findById(id);
    await this.saleRepo.remove(sale);
  }

  async getSalesSummary(): Promise<SalesSummary> {
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = today.substring(0, 8) + '01';

    // Today's sales
    const todayResult = await this.saleRepo
      .createQueryBuilder('sale')
      .select('COUNT(sale.id)', 'count')
      .where('sale.sale_date = :today', { today })
      .getRawOne();

    // Today's boxes sold
    const todayBoxesResult = await this.saleItemRepo
      .createQueryBuilder('si')
      .innerJoin('si.sale', 'sale')
      .select('COALESCE(SUM(si.quantity), 0)', 'total')
      .where('sale.sale_date = :today', { today })
      .getRawOne();

    // Monthly sales count
    const monthResult = await this.saleRepo
      .createQueryBuilder('sale')
      .select('COUNT(sale.id)', 'count')
      .where('sale.sale_date >= :firstOfMonth', { firstOfMonth })
      .andWhere('sale.sale_date <= :today', { today })
      .getRawOne();

    // Monthly boxes sold
    const monthBoxesResult = await this.saleItemRepo
      .createQueryBuilder('si')
      .innerJoin('si.sale', 'sale')
      .select('COALESCE(SUM(si.quantity), 0)', 'total')
      .where('sale.sale_date >= :firstOfMonth', { firstOfMonth })
      .andWhere('sale.sale_date <= :today', { today })
      .getRawOne();

    return {
      todaySales: parseInt(todayResult.count, 10),
      todayBoxesSold: parseInt(todayBoxesResult.total, 10),
      monthlySales: parseInt(monthResult.count, 10),
      monthlyBoxesSold: parseInt(monthBoxesResult.total, 10),
    };
  }
}
