import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { TfmProductionOutput } from '../entities/tfm-production-output.entity';
import { PrintingRecord } from '../entities/printing-record.entity';
import { PackingRecord } from '../entities/packing-record.entity';
import { CreateProductDto, UpdateProductDto } from '../dto/product.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(TfmProductionOutput)
    private readonly tfmProductionOutputRepository: Repository<TfmProductionOutput>,
    @InjectRepository(PrintingRecord)
    private readonly printingRecordRepository: Repository<PrintingRecord>,
    @InjectRepository(PackingRecord)
    private readonly packingRecordRepository: Repository<PackingRecord>
  ) {}

  async create(dto: CreateProductDto, userId: string): Promise<Product> {
    const name = dto.name.trim();
    const size = dto.size.trim();
    const colour = dto.colour.trim();

    await this.checkUniqueConstraint(name, size, colour);

    const product = this.productRepository.create({
      name,
      size,
      volume: dto.volume.trim(),
      colour,
      weightPerCup: dto.weightPerCup,
      quantityPerBox: dto.quantityPerBox,
      isActive: true,
      createdBy: userId,
    });

    return this.productRepository.save(product);
  }

  async update(id: string, dto: UpdateProductDto, userId: string): Promise<Product> {
    const product = await this.findById(id);

    const name = dto.name !== undefined ? dto.name.trim() : product.name;
    const size = dto.size !== undefined ? dto.size.trim() : product.size;
    const colour = dto.colour !== undefined ? dto.colour.trim() : product.colour;

    // Check unique constraint if name, size, or colour changed
    const nameChanged = dto.name !== undefined && name.toLowerCase() !== product.name.toLowerCase();
    const sizeChanged = dto.size !== undefined && size.toLowerCase() !== product.size.toLowerCase();
    const colourChanged =
      dto.colour !== undefined && colour.toLowerCase() !== product.colour.toLowerCase();

    if (nameChanged || sizeChanged || colourChanged) {
      await this.checkUniqueConstraint(name, size, colour, id);
    }

    // Apply updates
    if (dto.name !== undefined) product.name = name;
    if (dto.size !== undefined) product.size = size;
    if (dto.volume !== undefined) product.volume = dto.volume.trim();
    if (dto.colour !== undefined) product.colour = colour;
    if (dto.weightPerCup !== undefined) product.weightPerCup = dto.weightPerCup;
    if (dto.quantityPerBox !== undefined) product.quantityPerBox = dto.quantityPerBox;
    if (dto.isActive !== undefined) product.isActive = dto.isActive;

    product.updatedBy = userId;

    return this.productRepository.save(product);
  }

  async delete(id: string): Promise<void> {
    const product = await this.findById(id);

    // Check references in TfmProductionOutput
    const tfmCount = await this.tfmProductionOutputRepository.count({
      where: { productId: product.id },
    });
    if (tfmCount > 0) {
      throw new ConflictException('PRODUCT_IN_USE');
    }

    // Check references in PrintingRecord (soft-delete aware)
    const printingCount = await this.printingRecordRepository
      .createQueryBuilder('pr')
      .where('pr.product_id = :productId', { productId: product.id })
      .andWhere('pr.deleted_at IS NULL')
      .getCount();
    if (printingCount > 0) {
      throw new ConflictException('PRODUCT_IN_USE');
    }

    // Check references in PackingRecord (soft-delete aware)
    const packingCount = await this.packingRecordRepository
      .createQueryBuilder('pr')
      .where('pr.product_id = :productId', { productId: product.id })
      .andWhere('pr.deleted_at IS NULL')
      .getCount();
    if (packingCount > 0) {
      throw new ConflictException('PRODUCT_IN_USE');
    }

    // Hard-delete
    await this.productRepository.remove(product);
  }

  async deactivate(id: string, userId: string): Promise<Product> {
    const product = await this.findById(id);
    product.isActive = false;
    product.updatedBy = userId;
    return this.productRepository.save(product);
  }

  async list(filters: {
    name?: string;
    size?: string;
    colour?: string;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: Product[];
    total: number;
    page: number;
    pageSize: number;
    hasNextPage: boolean;
  }> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;

    const qb = this.productRepository.createQueryBuilder('product');

    if (filters.name) {
      qb.andWhere('product.name ILIKE :name', { name: `%${filters.name}%` });
    }

    if (filters.size) {
      qb.andWhere('product.size = :size', { size: filters.size });
    }

    if (filters.colour) {
      qb.andWhere('product.colour = :colour', { colour: filters.colour });
    }

    if (filters.isActive !== undefined) {
      qb.andWhere('product.is_active = :isActive', {
        isActive: filters.isActive,
      });
    }

    qb.orderBy('product.name', 'ASC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      hasNextPage: page * pageSize < total,
    };
  }

  async findById(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  // --- Private helpers ---

  private async checkUniqueConstraint(
    name: string,
    size: string,
    colour: string,
    excludeId?: string
  ): Promise<void> {
    const qb = this.productRepository
      .createQueryBuilder('product')
      .where('LOWER(product.name) = LOWER(:name)', { name })
      .andWhere('LOWER(product.size) = LOWER(:size)', { size })
      .andWhere('LOWER(product.colour) = LOWER(:colour)', { colour });

    if (excludeId) {
      qb.andWhere('product.id != :excludeId', { excludeId });
    }

    const existing = await qb.getOne();

    if (existing) {
      throw new ConflictException('PRODUCT_DUPLICATE');
    }
  }
}
