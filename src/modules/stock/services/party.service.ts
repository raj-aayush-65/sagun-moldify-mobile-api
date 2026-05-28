import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Party } from '../entities/party.entity';
import { PrintingRecord } from '../entities/printing-record.entity';
import { PackingRecord } from '../entities/packing-record.entity';
import { CreatePartyDto, UpdatePartyDto } from '../dto/party.dto';

@Injectable()
export class PartyService {
  constructor(
    @InjectRepository(Party)
    private readonly partyRepository: Repository<Party>,
    @InjectRepository(PrintingRecord)
    private readonly printingRecordRepository: Repository<PrintingRecord>,
    @InjectRepository(PackingRecord)
    private readonly packingRecordRepository: Repository<PackingRecord>
  ) {}

  async create(dto: CreatePartyDto, userId: string): Promise<Party> {
    const name = dto.name.trim();

    // Check case-insensitive duplicate
    const existing = await this.partyRepository
      .createQueryBuilder('party')
      .where('LOWER(party.name) = LOWER(:name)', { name })
      .getOne();

    if (existing) {
      throw new ConflictException('PARTY_DUPLICATE');
    }

    const party = this.partyRepository.create({
      name,
      contactInfo: dto.contactInfo,
      isActive: true,
      createdBy: userId,
    });

    return this.partyRepository.save(party);
  }

  async update(id: string, dto: UpdatePartyDto, userId: string): Promise<Party> {
    const party = await this.partyRepository.findOne({ where: { id } });

    if (!party) {
      throw new NotFoundException('Party not found');
    }

    // Check duplicate name if changed (case-insensitive)
    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      if (trimmedName.toLowerCase() !== party.name.toLowerCase()) {
        const existing = await this.partyRepository
          .createQueryBuilder('party')
          .where('LOWER(party.name) = LOWER(:name)', { name: trimmedName })
          .andWhere('party.id != :id', { id })
          .getOne();

        if (existing) {
          throw new ConflictException('PARTY_DUPLICATE');
        }
      }
      party.name = trimmedName;
    }

    if (dto.contactInfo !== undefined) {
      party.contactInfo = dto.contactInfo;
    }

    if (dto.isActive !== undefined) {
      party.isActive = dto.isActive;
    }

    party.updatedBy = userId;

    return this.partyRepository.save(party);
  }

  async delete(id: string): Promise<void> {
    const party = await this.partyRepository.findOne({ where: { id } });

    if (!party) {
      throw new NotFoundException('Party not found');
    }

    // Check references in PrintingRecord (non-deleted)
    const printingCount = await this.printingRecordRepository
      .createQueryBuilder('pr')
      .where('pr.partyId = :id', { id })
      .andWhere('pr.deletedAt IS NULL')
      .getCount();

    if (printingCount > 0) {
      throw new ConflictException('PARTY_IN_USE');
    }

    // Check references in PackingRecord (non-deleted)
    const packingCount = await this.packingRecordRepository
      .createQueryBuilder('pk')
      .where('pk.partyId = :id', { id })
      .andWhere('pk.deletedAt IS NULL')
      .getCount();

    if (packingCount > 0) {
      throw new ConflictException('PARTY_IN_USE');
    }

    // Hard-delete
    await this.partyRepository.remove(party);
  }

  async deactivate(id: string, userId: string): Promise<Party> {
    const party = await this.partyRepository.findOne({ where: { id } });

    if (!party) {
      throw new NotFoundException('Party not found');
    }

    party.isActive = false;
    party.updatedBy = userId;

    return this.partyRepository.save(party);
  }

  async list(filters: {
    name?: string;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: Party[];
    total: number;
    page: number;
    pageSize: number;
    hasNextPage: boolean;
  }> {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;

    const query = this.partyRepository.createQueryBuilder('party');

    // Name filter (case-insensitive substring)
    if (filters.name) {
      query.andWhere('party.name ILIKE :name', { name: `%${filters.name}%` });
    }

    // isActive filter
    if (filters.isActive !== undefined) {
      query.andWhere('party.isActive = :isActive', { isActive: filters.isActive });
    }

    // Sort by name ASC
    query.orderBy('party.name', 'ASC');

    // Pagination
    const total = await query.getCount();
    const items = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    const hasNextPage = page * pageSize < total;

    return { items, total, page, pageSize, hasNextPage };
  }

  async findById(id: string): Promise<Party> {
    const party = await this.partyRepository.findOne({ where: { id } });

    if (!party) {
      throw new NotFoundException('Party not found');
    }

    return party;
  }
}
