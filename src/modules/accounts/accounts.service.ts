import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Account } from './entities/account.entity';
import { AccountTransfer } from './entities/account-transfer.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { AccountType } from './enums/account-type.enum';
import { AccountStatus } from './enums/account-status.enum';
import { AccountBalanceService } from '../expenses/account-balance.service';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(AccountTransfer)
    private accountTransferRepository: Repository<AccountTransfer>,
    private readonly dataSource: DataSource,
    private readonly accountBalanceService: AccountBalanceService,
  ) {}

  async create(dto: CreateAccountDto, userId: string): Promise<Account> {
    // Type-specific validation
    this.validateAccountTypeFields(dto);

    // Check unique constraint on (name, accountType) for active accounts
    await this.checkDuplicateName(dto.name, dto.accountType);

    const accountData: Partial<Account> = {
      name: dto.name,
      accountType: dto.accountType,
      status: AccountStatus.ACTIVE,
      last4: dto.last4 || undefined,
      notes: dto.notes || undefined,
      createdBy: userId,
    };

    // Set type-specific fields
    switch (dto.accountType) {
      case AccountType.BANK:
      case AccountType.CASH:
        accountData.openingBalance = dto.openingBalance!;
        accountData.currentBalance = dto.openingBalance!;
        break;
      case AccountType.CREDIT_CARD:
        accountData.creditLimit = dto.creditLimit!;
        accountData.currentOutstanding = dto.currentOutstanding!;
        break;
      case AccountType.OVERDRAFT:
        accountData.overdraftLimit = dto.overdraftLimit!;
        accountData.currentOutstanding = dto.currentOutstanding!;
        break;
      case AccountType.LOAN:
        accountData.principalOutstanding = dto.principalOutstanding!;
        break;
    }

    const account = this.accountRepository.create(accountData);
    return this.accountRepository.save(account);
  }

  async update(id: string, dto: UpdateAccountDto, userId: string): Promise<Account> {
    const account = await this.findOneOrFail(id);

    // Reject accountType change
    if (dto.accountType !== undefined && dto.accountType !== account.accountType) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Account type cannot be changed after creation',
          data: { code: 'ACCOUNT_TYPE_IMMUTABLE' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check unique constraint if name is being changed
    if (dto.name !== undefined && dto.name !== account.name) {
      await this.checkDuplicateName(dto.name, account.accountType, id);
    }

    // Update editable fields
    if (dto.name !== undefined) account.name = dto.name;
    if (dto.last4 !== undefined) account.last4 = dto.last4;
    if (dto.notes !== undefined) account.notes = dto.notes;
    if (dto.creditLimit !== undefined) account.creditLimit = dto.creditLimit;
    if (dto.overdraftLimit !== undefined) account.overdraftLimit = dto.overdraftLimit;

    // Update audit fields
    account.updatedBy = userId;
    account.updatedAt = new Date();

    return this.accountRepository.save(account);
  }

  async delete(id: string, userId: string): Promise<{ action: 'deleted' | 'archived' }> {
    const account = await this.findOneOrFail(id);

    // Check if account is referenced by non-deleted expenses or transfers
    const hasReferences = await this.hasActiveReferences(id);

    if (hasReferences) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Account is referenced by existing expenses or transfers and cannot be deleted. Consider archiving instead.',
          data: { code: 'ACCOUNT_IN_USE' },
        },
        HttpStatus.CONFLICT,
      );
    }

    // Soft-delete the account
    account.deletedBy = userId;
    account.deletedAt = new Date();
    await this.accountRepository.save(account);

    return { action: 'deleted' };
  }

  async archive(id: string, userId: string): Promise<Account> {
    const account = await this.findOneOrFail(id);

    account.status = AccountStatus.ARCHIVED;
    account.updatedBy = userId;
    account.updatedAt = new Date();

    return this.accountRepository.save(account);
  }

  async findAll(options?: { includeArchived?: boolean }): Promise<Account[]> {
    const query = this.accountRepository.createQueryBuilder('account');

    // Always exclude soft-deleted
    query.andWhere('account.deletedAt IS NULL');

    // Exclude archived by default
    if (!options?.includeArchived) {
      query.andWhere('account.status = :status', { status: AccountStatus.ACTIVE });
    }

    // Order by accountType then name
    query.orderBy('account.accountType', 'ASC');
    query.addOrderBy('account.name', 'ASC');

    return query.getMany();
  }

  async findById(id: string): Promise<Account> {
    return this.findOneOrFail(id);
  }

  // --- Private helpers ---

  private async findOneOrFail(id: string): Promise<Account> {
    const account = await this.accountRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!account) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Account not found',
          data: { code: 'ACCOUNT_NOT_FOUND' },
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return account;
  }

  private validateAccountTypeFields(dto: CreateAccountDto): void {
    switch (dto.accountType) {
      case AccountType.BANK:
      case AccountType.CASH:
        if (dto.openingBalance === undefined || dto.openingBalance === null) {
          throw new HttpException(
            {
              status: 'error',
              message: 'openingBalance is required for BANK/CASH accounts',
              data: { code: 'VALIDATION_ERROR' },
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        if (typeof dto.openingBalance !== 'number' || isNaN(dto.openingBalance)) {
          throw new HttpException(
            {
              status: 'error',
              message: 'openingBalance must be a valid number',
              data: { code: 'VALIDATION_ERROR' },
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        if (dto.openingBalance < 0) {
          throw new HttpException(
            {
              status: 'error',
              message: 'openingBalance must be >= 0 for BANK/CASH accounts',
              data: { code: 'VALIDATION_ERROR' },
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        break;

      case AccountType.CREDIT_CARD:
        if (dto.creditLimit === undefined || dto.creditLimit === null) {
          throw new HttpException(
            {
              status: 'error',
              message: 'creditLimit is required for CREDIT_CARD accounts',
              data: { code: 'VALIDATION_ERROR' },
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        if (dto.creditLimit <= 0) {
          throw new HttpException(
            {
              status: 'error',
              message: 'creditLimit must be > 0 for CREDIT_CARD accounts',
              data: { code: 'VALIDATION_ERROR' },
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        if (dto.currentOutstanding === undefined || dto.currentOutstanding === null) {
          throw new HttpException(
            {
              status: 'error',
              message: 'currentOutstanding is required for CREDIT_CARD accounts',
              data: { code: 'VALIDATION_ERROR' },
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        if (dto.currentOutstanding < 0) {
          throw new HttpException(
            {
              status: 'error',
              message: 'currentOutstanding must be >= 0 for CREDIT_CARD accounts',
              data: { code: 'VALIDATION_ERROR' },
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        if (dto.currentOutstanding > dto.creditLimit) {
          throw new HttpException(
            {
              status: 'error',
              message: 'currentOutstanding cannot exceed creditLimit for CREDIT_CARD accounts',
              data: { code: 'VALIDATION_ERROR' },
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        break;

      case AccountType.OVERDRAFT:
        if (dto.overdraftLimit === undefined || dto.overdraftLimit === null) {
          throw new HttpException(
            {
              status: 'error',
              message: 'overdraftLimit is required for OVERDRAFT accounts',
              data: { code: 'VALIDATION_ERROR' },
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        if (dto.overdraftLimit <= 0) {
          throw new HttpException(
            {
              status: 'error',
              message: 'overdraftLimit must be > 0 for OVERDRAFT accounts',
              data: { code: 'VALIDATION_ERROR' },
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        if (dto.currentOutstanding === undefined || dto.currentOutstanding === null) {
          throw new HttpException(
            {
              status: 'error',
              message: 'currentOutstanding is required for OVERDRAFT accounts',
              data: { code: 'VALIDATION_ERROR' },
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        if (dto.currentOutstanding < 0) {
          throw new HttpException(
            {
              status: 'error',
              message: 'currentOutstanding must be >= 0 for OVERDRAFT accounts',
              data: { code: 'VALIDATION_ERROR' },
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        if (dto.currentOutstanding > dto.overdraftLimit) {
          throw new HttpException(
            {
              status: 'error',
              message: 'currentOutstanding cannot exceed overdraftLimit for OVERDRAFT accounts',
              data: { code: 'VALIDATION_ERROR' },
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        break;

      case AccountType.LOAN:
        if (dto.principalOutstanding === undefined || dto.principalOutstanding === null) {
          throw new HttpException(
            {
              status: 'error',
              message: 'principalOutstanding is required for LOAN accounts',
              data: { code: 'VALIDATION_ERROR' },
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        if (dto.principalOutstanding < 0) {
          throw new HttpException(
            {
              status: 'error',
              message: 'principalOutstanding must be >= 0 for LOAN accounts',
              data: { code: 'VALIDATION_ERROR' },
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        break;
    }
  }

  private async checkDuplicateName(
    name: string,
    accountType: AccountType,
    excludeId?: string,
  ): Promise<void> {
    const query = this.accountRepository.createQueryBuilder('account')
      .where('account.name = :name', { name })
      .andWhere('account.accountType = :accountType', { accountType })
      .andWhere('account.status = :status', { status: AccountStatus.ACTIVE })
      .andWhere('account.deletedAt IS NULL');

    if (excludeId) {
      query.andWhere('account.id != :excludeId', { excludeId });
    }

    const existing = await query.getOne();

    if (existing) {
      throw new HttpException(
        {
          status: 'error',
          message: `An active account with name "${name}" and type "${accountType}" already exists`,
          data: { code: 'ACCOUNT_NAME_DUPLICATE' },
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  private async hasActiveReferences(accountId: string): Promise<boolean> {
    // Check for non-deleted expenses referencing this account
    // We use a raw query approach since Expense entity is in a different module
    const expenseCount = await this.accountRepository.manager
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('expense', 'e')
      .where('e.account_id = :accountId', { accountId })
      .andWhere('e.deleted_at IS NULL')
      .getRawOne();

    if (parseInt(expenseCount.count, 10) > 0) {
      return true;
    }

    // Check for non-deleted account transfers referencing this account
    const transferCount = await this.accountTransferRepository
      .createQueryBuilder('transfer')
      .where(
        '(transfer.fromAccountId = :accountId OR transfer.toAccountId = :accountId)',
        { accountId },
      )
      .andWhere('transfer.deletedAt IS NULL')
      .getCount();

    return transferCount > 0;
  }

  // --- Transfer methods ---

  async createTransfer(dto: CreateTransferDto, userId: string): Promise<AccountTransfer> {
    // Validate fromAccountId != toAccountId
    if (dto.fromAccountId === dto.toAccountId) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Cannot transfer to the same account',
          data: { code: 'TRANSFER_SAME_ACCOUNT' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate both accounts exist and are not LOAN type
    const fromAccount = await this.accountRepository.findOne({
      where: { id: dto.fromAccountId, deletedAt: IsNull() },
    });
    const toAccount = await this.accountRepository.findOne({
      where: { id: dto.toAccountId, deletedAt: IsNull() },
    });

    if (!fromAccount) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Source account not found',
          data: { code: 'ACCOUNT_NOT_FOUND' },
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (!toAccount) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Destination account not found',
          data: { code: 'ACCOUNT_NOT_FOUND' },
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Reject LOAN accounts
    if (fromAccount.accountType === AccountType.LOAN || toAccount.accountType === AccountType.LOAN) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Transfers involving LOAN accounts are not allowed',
          data: { code: 'ACCOUNT_TYPE_NOT_TRANSFERABLE' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Use QueryRunner transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Persist the transfer record
      const transfer = queryRunner.manager.create(AccountTransfer, {
        fromAccountId: dto.fromAccountId,
        toAccountId: dto.toAccountId,
        amount: dto.amount,
        transferDate: dto.transferDate,
        description: dto.description,
        createdBy: userId,
      });

      const savedTransfer = await queryRunner.manager.save(AccountTransfer, transfer);

      // Apply balance impact on both accounts
      await this.accountBalanceService.applyTransferImpact(savedTransfer, queryRunner);

      await queryRunner.commitTransaction();

      // Return with relations
      const result = await this.accountTransferRepository.findOne({
        where: { id: savedTransfer.id },
        relations: ['fromAccount', 'toAccount'],
      });

      return result!;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAllTransfers(): Promise<AccountTransfer[]> {
    return this.accountTransferRepository.find({
      where: { deletedAt: IsNull() },
      relations: ['fromAccount', 'toAccount'],
      order: { createdAt: 'DESC' },
    });
  }

  async deleteTransfer(id: string, userId: string): Promise<void> {
    const transfer = await this.accountTransferRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!transfer) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Transfer not found',
          data: { code: 'TRANSFER_NOT_FOUND' },
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Use QueryRunner transaction for soft-delete with balance reversal
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Reverse balance impact on both accounts
      await this.accountBalanceService.reverseTransferImpact(transfer, queryRunner);

      // Soft-delete the transfer
      transfer.deletedBy = userId;
      transfer.deletedAt = new Date();
      await queryRunner.manager.save(AccountTransfer, transfer);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // --- Recompute balance ---

  async recomputeBalance(accountId: string): Promise<{ prior: number; recomputed: number }> {
    return this.accountBalanceService.recomputeBalance(accountId);
  }
}
