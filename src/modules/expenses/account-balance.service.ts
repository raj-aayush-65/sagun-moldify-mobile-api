import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, IsNull } from 'typeorm';
import { Account } from '../accounts/entities/account.entity';
import { AccountTransfer } from '../accounts/entities/account-transfer.entity';
import { Expense } from './entities/expense.entity';
import { Refund } from './entities/refund.entity';
import { AccountType } from '../accounts/enums/account-type.enum';

export interface BalanceOperationResult {
  lowBalance?: boolean;
}

@Injectable()
export class AccountBalanceService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Refund)
    private readonly refundRepository: Repository<Refund>,
    @InjectRepository(AccountTransfer)
    private readonly accountTransferRepository: Repository<AccountTransfer>,
  ) {}

  private isAssetAccount(accountType: AccountType): boolean {
    return accountType === AccountType.BANK || accountType === AccountType.CASH;
  }

  private isLiabilityAccount(accountType: AccountType): boolean {
    return (
      accountType === AccountType.CREDIT_CARD ||
      accountType === AccountType.OVERDRAFT
    );
  }

  private getAccountLimit(account: Account): number {
    if (account.accountType === AccountType.CREDIT_CARD) {
      return Number(account.creditLimit) || 0;
    }
    if (account.accountType === AccountType.OVERDRAFT) {
      return Number(account.overdraftLimit) || 0;
    }
    return 0;
  }

  /**
   * Apply the balance impact of an expense on its linked account.
   * - Asset_Account (BANK/CASH): decrement currentBalance by expense.amount
   * - Liability_Account (CREDIT_CARD/OVERDRAFT): increment currentOutstanding
   *   with limit check before incrementing.
   * - If Asset_Account would go negative: allow but return lowBalance: true
   */
  async applyExpenseImpact(
    expense: Expense,
    queryRunner: QueryRunner,
  ): Promise<BalanceOperationResult> {
    const result: BalanceOperationResult = {};

    const account = await queryRunner.manager.findOne(Account, {
      where: { id: expense.accountId },
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

    const amount = Number(expense.amount);

    if (this.isAssetAccount(account.accountType)) {
      await queryRunner.query(
        `UPDATE account SET current_balance = current_balance - $1 WHERE id = $2`,
        [amount, account.id],
      );

      // Check if balance went negative for warning
      const updatedAccount = await queryRunner.manager.findOne(Account, {
        where: { id: account.id },
      });
      if (updatedAccount && Number(updatedAccount.currentBalance) < 0) {
        result.lowBalance = true;
      }
    } else if (this.isLiabilityAccount(account.accountType)) {
      const currentOutstanding = Number(account.currentOutstanding) || 0;
      const limit = this.getAccountLimit(account);
      const newOutstanding = currentOutstanding + amount;

      if (newOutstanding > limit) {
        const availableHeadroom = Math.max(0, limit - currentOutstanding);
        throw new HttpException(
          {
            status: 'error',
            message: `Operation would exceed account limit. Available headroom: ${availableHeadroom.toFixed(2)}`,
            data: {
              code: 'ACCOUNT_LIMIT_EXCEEDED',
              details: { availableHeadroom },
            },
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      await queryRunner.query(
        `UPDATE account SET current_outstanding = current_outstanding + $1 WHERE id = $2`,
        [amount, account.id],
      );
    }

    return result;
  }

  /**
   * Reverse the balance impact of an expense (for update/delete).
   * - Asset_Account: increment currentBalance by expense.amount
   * - Liability_Account: decrement currentOutstanding by expense.amount
   */
  async reverseExpenseImpact(
    expense: Expense,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const account = await queryRunner.manager.findOne(Account, {
      where: { id: expense.accountId },
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

    const amount = Number(expense.amount);

    if (this.isAssetAccount(account.accountType)) {
      await queryRunner.query(
        `UPDATE account SET current_balance = current_balance + $1 WHERE id = $2`,
        [amount, account.id],
      );
    } else if (this.isLiabilityAccount(account.accountType)) {
      await queryRunner.query(
        `UPDATE account SET current_outstanding = current_outstanding - $1 WHERE id = $2`,
        [amount, account.id],
      );
    }
  }

  /**
   * Handle expense creation: apply balance impact if accountId is not null.
   */
  async handleExpenseCreate(
    expense: Expense,
    queryRunner: QueryRunner,
  ): Promise<BalanceOperationResult> {
    if (!expense.accountId) {
      return {};
    }
    return this.applyExpenseImpact(expense, queryRunner);
  }

  /**
   * Handle expense update: reverse old impact and apply new impact.
   */
  async handleExpenseUpdate(
    oldExpense: Expense,
    newExpense: Expense,
    queryRunner: QueryRunner,
  ): Promise<BalanceOperationResult> {
    if (oldExpense.accountId) {
      await this.reverseExpenseImpact(oldExpense, queryRunner);
    }

    if (newExpense.accountId) {
      return this.applyExpenseImpact(newExpense, queryRunner);
    }

    return {};
  }

  /**
   * Handle expense deletion: reverse balance impact if accountId is not null.
   */
  async handleExpenseDelete(
    expense: Expense,
    queryRunner: QueryRunner,
  ): Promise<void> {
    if (!expense.accountId) {
      return;
    }
    await this.reverseExpenseImpact(expense, queryRunner);
  }

  /**
   * Recompute the balance for an account from scratch.
   * Calculates from opening value + sum of all non-deleted expenses
   * (subtract for asset, add for liability) + transfers (in/out) + refunds.
   * Persists the recomputed value and returns { prior, recomputed }.
   */
  async recomputeBalance(
    accountId: string,
  ): Promise<{ prior: number; recomputed: number }> {
    const account = await this.accountRepository.findOne({
      where: { id: accountId, deletedAt: IsNull() },
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

    if (this.isAssetAccount(account.accountType)) {
      return this.recomputeAssetBalance(account);
    } else if (this.isLiabilityAccount(account.accountType)) {
      return this.recomputeLiabilityBalance(account);
    }

    // For LOAN accounts, no recompute needed
    return {
      prior: Number(account.principalOutstanding) || 0,
      recomputed: Number(account.principalOutstanding) || 0,
    };
  }

  /**
   * Recompute balance for an Asset account (BANK/CASH).
   * Formula: openingBalance - expenses + transfers_in - transfers_out + refunds
   */
  private async recomputeAssetBalance(
    account: Account,
  ): Promise<{ prior: number; recomputed: number }> {
    const prior = Number(account.currentBalance) || 0;
    const openingBalance = Number(account.openingBalance) || 0;

    // Sum of non-deleted expenses linked to this account
    const expenseSumResult = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.accountId = :accountId', { accountId: account.id })
      .andWhere('expense.deletedAt IS NULL')
      .getRawOne();
    const expenseTotal = parseFloat(expenseSumResult?.total || '0');

    // Sum of non-deleted transfers INTO this account (destination)
    const transfersInResult = await this.accountTransferRepository
      .createQueryBuilder('transfer')
      .select('COALESCE(SUM(transfer.amount), 0)', 'total')
      .where('transfer.toAccountId = :accountId', { accountId: account.id })
      .andWhere('transfer.deletedAt IS NULL')
      .getRawOne();
    const transfersIn = parseFloat(transfersInResult?.total || '0');

    // Sum of non-deleted transfers OUT of this account (source)
    const transfersOutResult = await this.accountTransferRepository
      .createQueryBuilder('transfer')
      .select('COALESCE(SUM(transfer.amount), 0)', 'total')
      .where('transfer.fromAccountId = :accountId', { accountId: account.id })
      .andWhere('transfer.deletedAt IS NULL')
      .getRawOne();
    const transfersOut = parseFloat(transfersOutResult?.total || '0');

    // Sum of non-deleted refunds on non-deleted expenses linked to this account
    // Refunds reverse the expense impact, so they ADD back to asset balance
    const refundSumResult = await this.refundRepository
      .createQueryBuilder('refund')
      .innerJoin('refund.expense', 'expense')
      .select('COALESCE(SUM(refund.amount), 0)', 'total')
      .where('expense.accountId = :accountId', { accountId: account.id })
      .andWhere('refund.deletedAt IS NULL')
      .andWhere('expense.deletedAt IS NULL')
      .getRawOne();
    const refundTotal = parseFloat(refundSumResult?.total || '0');

    const recomputed =
      openingBalance - expenseTotal + transfersIn - transfersOut + refundTotal;

    await this.accountRepository.update(account.id, {
      currentBalance: recomputed,
    });

    return { prior, recomputed };
  }

  /**
   * Recompute balance for a Liability account (CREDIT_CARD/OVERDRAFT).
   * For liability accounts:
   *   - Expenses INCREASE outstanding
   *   - Transfers FROM this account DECREASE outstanding (paying off)
   *   - Transfers TO this account INCREASE outstanding
   *   - Refunds DECREASE outstanding (reverse of expense)
   * Uses 0 as the opening base since the initial currentOutstanding was set at creation.
   */
  private async recomputeLiabilityBalance(
    account: Account,
  ): Promise<{ prior: number; recomputed: number }> {
    const prior = Number(account.currentOutstanding) || 0;
    const openingOutstanding = 0;

    // Sum of non-deleted expenses linked to this account (increases outstanding)
    const expenseSumResult = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.accountId = :accountId', { accountId: account.id })
      .andWhere('expense.deletedAt IS NULL')
      .getRawOne();
    const expenseTotal = parseFloat(expenseSumResult?.total || '0');

    // Sum of non-deleted transfers TO this account (increases outstanding)
    const transfersInResult = await this.accountTransferRepository
      .createQueryBuilder('transfer')
      .select('COALESCE(SUM(transfer.amount), 0)', 'total')
      .where('transfer.toAccountId = :accountId', { accountId: account.id })
      .andWhere('transfer.deletedAt IS NULL')
      .getRawOne();
    const transfersIn = parseFloat(transfersInResult?.total || '0');

    // Sum of non-deleted transfers FROM this account (decreases outstanding)
    const transfersOutResult = await this.accountTransferRepository
      .createQueryBuilder('transfer')
      .select('COALESCE(SUM(transfer.amount), 0)', 'total')
      .where('transfer.fromAccountId = :accountId', { accountId: account.id })
      .andWhere('transfer.deletedAt IS NULL')
      .getRawOne();
    const transfersOut = parseFloat(transfersOutResult?.total || '0');

    // Sum of non-deleted refunds on non-deleted expenses linked to this account
    const refundSumResult = await this.refundRepository
      .createQueryBuilder('refund')
      .innerJoin('refund.expense', 'expense')
      .select('COALESCE(SUM(refund.amount), 0)', 'total')
      .where('expense.accountId = :accountId', { accountId: account.id })
      .andWhere('refund.deletedAt IS NULL')
      .andWhere('expense.deletedAt IS NULL')
      .getRawOne();
    const refundTotal = parseFloat(refundSumResult?.total || '0');

    const recomputed =
      openingOutstanding + expenseTotal + transfersIn - transfersOut - refundTotal;

    await this.accountRepository.update(account.id, {
      currentOutstanding: recomputed,
    });

    return { prior, recomputed };
  }

  /**
   * Apply the balance impact of a transfer on both accounts.
   * - Source Asset_Account: decrement currentBalance
   * - Source Liability_Account: decrement currentOutstanding (reject if < amount)
   * - Destination Asset_Account: increment currentBalance
   * - Destination Liability_Account: increment currentOutstanding (apply limit check)
   */
  async applyTransferImpact(
    transfer: AccountTransfer,
    queryRunner: QueryRunner,
  ): Promise<BalanceOperationResult> {
    const result: BalanceOperationResult = {};

    const sourceAccount = await queryRunner.manager.findOne(Account, {
      where: { id: transfer.fromAccountId },
    });

    const destAccount = await queryRunner.manager.findOne(Account, {
      where: { id: transfer.toAccountId },
    });

    if (!sourceAccount || !destAccount) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Account not found',
          data: { code: 'ACCOUNT_NOT_FOUND' },
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const amount = Number(transfer.amount);

    // --- Source account impact ---
    if (this.isAssetAccount(sourceAccount.accountType)) {
      await queryRunner.query(
        `UPDATE account SET current_balance = current_balance - $1 WHERE id = $2`,
        [amount, sourceAccount.id],
      );

      const updatedSource = await queryRunner.manager.findOne(Account, {
        where: { id: sourceAccount.id },
      });
      if (updatedSource && Number(updatedSource.currentBalance) < 0) {
        result.lowBalance = true;
      }
    } else if (this.isLiabilityAccount(sourceAccount.accountType)) {
      // For liability source: decrement outstanding (paying off the liability)
      const currentOutstanding = Number(sourceAccount.currentOutstanding) || 0;
      if (currentOutstanding < amount) {
        throw new HttpException(
          {
            status: 'error',
            message: `Cannot transfer more than current outstanding. Current outstanding: ${currentOutstanding.toFixed(2)}`,
            data: {
              code: 'INSUFFICIENT_OUTSTANDING',
              details: { currentOutstanding },
            },
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      await queryRunner.query(
        `UPDATE account SET current_outstanding = current_outstanding - $1 WHERE id = $2`,
        [amount, sourceAccount.id],
      );
    }

    // --- Destination account impact ---
    if (this.isAssetAccount(destAccount.accountType)) {
      await queryRunner.query(
        `UPDATE account SET current_balance = current_balance + $1 WHERE id = $2`,
        [amount, destAccount.id],
      );
    } else if (this.isLiabilityAccount(destAccount.accountType)) {
      const currentOutstanding = Number(destAccount.currentOutstanding) || 0;
      const limit = this.getAccountLimit(destAccount);
      const newOutstanding = currentOutstanding + amount;

      if (newOutstanding > limit) {
        const availableHeadroom = Math.max(0, limit - currentOutstanding);
        throw new HttpException(
          {
            status: 'error',
            message: `Transfer would exceed destination account limit. Available headroom: ${availableHeadroom.toFixed(2)}`,
            data: {
              code: 'ACCOUNT_LIMIT_EXCEEDED',
              details: { availableHeadroom },
            },
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      await queryRunner.query(
        `UPDATE account SET current_outstanding = current_outstanding + $1 WHERE id = $2`,
        [amount, destAccount.id],
      );
    }

    return result;
  }

  /**
   * Reverse both sides of a transfer (for soft-delete).
   */
  async reverseTransferImpact(
    transfer: AccountTransfer,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const sourceAccount = await queryRunner.manager.findOne(Account, {
      where: { id: transfer.fromAccountId },
    });

    const destAccount = await queryRunner.manager.findOne(Account, {
      where: { id: transfer.toAccountId },
    });

    if (!sourceAccount || !destAccount) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Account not found',
          data: { code: 'ACCOUNT_NOT_FOUND' },
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const amount = Number(transfer.amount);

    // Reverse source: was decremented, now increment back
    if (this.isAssetAccount(sourceAccount.accountType)) {
      await queryRunner.query(
        `UPDATE account SET current_balance = current_balance + $1 WHERE id = $2`,
        [amount, sourceAccount.id],
      );
    } else if (this.isLiabilityAccount(sourceAccount.accountType)) {
      await queryRunner.query(
        `UPDATE account SET current_outstanding = current_outstanding + $1 WHERE id = $2`,
        [amount, sourceAccount.id],
      );
    }

    // Reverse destination: was incremented, now decrement back
    if (this.isAssetAccount(destAccount.accountType)) {
      await queryRunner.query(
        `UPDATE account SET current_balance = current_balance - $1 WHERE id = $2`,
        [amount, destAccount.id],
      );
    } else if (this.isLiabilityAccount(destAccount.accountType)) {
      await queryRunner.query(
        `UPDATE account SET current_outstanding = current_outstanding - $1 WHERE id = $2`,
        [amount, destAccount.id],
      );
    }
  }
}
