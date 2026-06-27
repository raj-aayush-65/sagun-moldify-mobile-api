import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../entities/company.entity';
import { Sale } from '../entities/sale.entity';
import { CreateCompanyDto, UpdateCompanyDto } from '../dto/company.dto';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>
  ) {}

  async create(dto: CreateCompanyDto, userId: string): Promise<Company> {
    await this.checkUniqueName(dto.name.trim());

    const company = this.companyRepo.create({
      name: dto.name.trim(),
      phone: dto.phone || undefined,
      address: dto.address || undefined,
      gstNumber: dto.gstNumber || undefined,
      contactPerson: dto.contactPerson || undefined,
      isActive: true,
      createdBy: userId,
    });

    return this.companyRepo.save(company);
  }

  async update(id: string, dto: UpdateCompanyDto, userId: string): Promise<Company> {
    const company = await this.findById(id);

    if (dto.name !== undefined && dto.name.trim().toLowerCase() !== company.name.toLowerCase()) {
      await this.checkUniqueName(dto.name.trim(), id);
      company.name = dto.name.trim();
    }

    if (dto.phone !== undefined) company.phone = dto.phone;
    if (dto.address !== undefined) company.address = dto.address;
    if (dto.gstNumber !== undefined) company.gstNumber = dto.gstNumber;
    if (dto.contactPerson !== undefined) company.contactPerson = dto.contactPerson;
    if (dto.isActive !== undefined) company.isActive = dto.isActive;
    company.updatedBy = userId;

    return this.companyRepo.save(company);
  }

  async delete(id: string): Promise<void> {
    const company = await this.findById(id);

    const salesCount = await this.saleRepo.count({ where: { companyId: company.id } });
    if (salesCount > 0) {
      throw new ConflictException('COMPANY_HAS_SALES');
    }

    await this.companyRepo.remove(company);
  }

  async findAll(isActive?: boolean): Promise<Company[]> {
    const qb = this.companyRepo.createQueryBuilder('c');

    if (isActive !== undefined) {
      qb.where('c.is_active = :isActive', { isActive });
    }

    qb.orderBy('c.name', 'ASC');
    return qb.getMany();
  }

  async findById(id: string): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { id } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  private async checkUniqueName(name: string, excludeId?: string): Promise<void> {
    const qb = this.companyRepo
      .createQueryBuilder('c')
      .where('LOWER(c.name) = LOWER(:name)', { name });

    if (excludeId) {
      qb.andWhere('c.id != :excludeId', { excludeId });
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new ConflictException('COMPANY_NAME_DUPLICATE');
    }
  }
}
