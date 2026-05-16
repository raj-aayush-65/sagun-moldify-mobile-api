import {
  Injectable,
  HttpException,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Expense } from './entities/expense.entity';
import { Refund } from './entities/refund.entity';
import { Account } from '../accounts/entities/account.entity';
import { Employee } from '../employees/entities/employee.entity';
import { PayrollRun, PayrollStatus } from '../payroll/entities/payroll-run.entity';
import { ExpenseType } from './enums/expense-type.enum';
import { ExpenseCategory } from './enums/expense-category.enum';
import { AccountType } from '../accounts/enums/account-type.enum';
import { UserRole } from '../../common/enums/user-role.enum';

interface CreateExpenseInput {
  amount: number;
  description: string;
  expenseDate: string;
  expenseType: ExpenseType;
  category?: ExpenseCategory;
  accountId?: string | null;
  employeeId?: string | null;
  notes?: string | null;
}

interface UpdateExpenseInput {
  amount?: number;
  description?: string;
  expenseDate?: string;
  expenseType?: ExpenseType;
  category?: ExpenseCategory;
  accountId?: string | null;
  employeeId?: string | null;
  notes?: string | null;
}

interface AuthenticatedUser {
  id: string;
  role: UserRole;
  isSuperAdmin: boolean;
}

interface FindAllExpensesQuery {
  month?: string; // YYYY-MM format
  expenseType?: ExpenseType;
  category?: ExpenseCategory;
  accountId?: string;
  employeeId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}

export interface FindAllExpensesResult {
  data: Expense[];
  page: number;
  pageSize: number;
  total: number;
  monthTotal: number;
  hasNextPage: boolean;
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Refund)
    private readonly refundRepository: Repository<Refund>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(PayrollRun)
    private readonly payrollRunRepository: Repository<PayrollRun>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a new expense with full validation
   */
  async create(input: CreateExpenseInput, user: AuthenticatedUser): Promise<Expense> {
    // Validate amount
    this.validateAmount(input.amount);

    // Validate description
    this.validateDescription(input.description);

    // Validate expenseDate
    this.validateExpenseDate(input.expenseDate);

    // Validate expenseType
    this.validateExpenseType(input.expenseType);

    // Validate category
    const category = this.resolveCategory(input.expenseType, input.category);

    // Validate employee for EMPLOYEE_ADVANCE
    if (input.expenseType === ExpenseType.EMPLOYEE_ADVANCE) {
      if (!input.employeeId) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Employee ID is required for Employee Advance expenses',
            data: { code: 'EMPLOYEE_REQUIRED_FOR_ADVANCE' },
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      await this.validateEmployee(input.employeeId);
    }

    // Validate account if provided
    if (input.accountId) {
      await this.validateAccountForExpense(input.accountId);
    }

    // Check Account_Required_Flag
    this.checkAccountRequired(input.accountId);

    // Check payroll lock for EMPLOYEE_ADVANCE
    if (input.expenseType === ExpenseType.EMPLOYEE_ADVANCE) {
      await this.checkPayrollLock(input.expenseDate);
    }

    // Create the expense
    const expense = this.expenseRepository.create({
      amount: input.amount,
      description: input.description.trim(),
      expenseDate: new Date(input.expenseDate),
      expenseType: input.expenseType,
      category,
      accountId: input.accountId || undefined,
      employeeId: input.employeeId || undefined,
      notes: input.notes || undefined,
      createdBy: user.id,
    } as Partial<Expense>);

    return this.expenseRepository.save(expense);
  }

  /**
   * Update an existing expense with permission and validation checks
   */
  async update(
    id: string,
    input: UpdateExpenseInput,
    user: AuthenticatedUser,
  ): Promise<Expense> {
    const expense = await this.findOneOrFail(id);

    // Permission check
    this.checkUpdatePermission(expense, user);

    // Determine the effective values after update
    const effectiveExpenseType = input.expenseType ?? expense.expenseType;
    const effectiveExpenseDate = input.expenseDate ?? this.dateToISOString(expense.expenseDate);
    const effectiveEmployeeId = input.employeeId !== undefined ? input.employeeId : expense.employeeId;
    const effectiveAccountId = input.accountId !== undefined ? input.accountId : expense.accountId;

    // Validate fields if provided
    if (input.amount !== undefined) {
      this.validateAmount(input.amount);
    }

    if (input.description !== undefined) {
      this.validateDescription(input.description);
    }

    if (input.expenseDate !== undefined) {
      this.validateExpenseDate(input.expenseDate);
    }

    if (input.expenseType !== undefined) {
      this.validateExpenseType(input.expenseType);
    }

    // Resolve category
    let effectiveCategory = expense.category;
    if (input.category !== undefined || input.expenseType !== undefined) {
      effectiveCategory = this.resolveCategory(effectiveExpenseType, input.category ?? expense.category);
    }

    // Validate employee for EMPLOYEE_ADVANCE
    if (effectiveExpenseType === ExpenseType.EMPLOYEE_ADVANCE) {
      if (!effectiveEmployeeId) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Employee ID is required for Employee Advance expenses',
            data: { code: 'EMPLOYEE_REQUIRED_FOR_ADVANCE' },
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      await this.validateEmployee(effectiveEmployeeId);
    }

    // Validate account if provided
    if (effectiveAccountId) {
      await this.validateAccountForExpense(effectiveAccountId);
    }

    // Check Account_Required_Flag
    this.checkAccountRequired(effectiveAccountId);

    // Payroll lock checks for EMPLOYEE_ADVANCE
    if (effectiveExpenseType === ExpenseType.EMPLOYEE_ADVANCE) {
      // Check if the current date is in a locked month
      await this.checkPayrollLock(effectiveExpenseDate);

      // If date is changing, also check the original date's month
      if (input.expenseDate !== undefined && expense.expenseType === ExpenseType.EMPLOYEE_ADVANCE) {
        const originalDateStr = this.dateToISOString(expense.expenseDate);
        if (originalDateStr !== input.expenseDate) {
          await this.checkPayrollLock(originalDateStr);
        }
      }
    }

    // Also check if moving OUT of EMPLOYEE_ADVANCE type from a locked month
    if (
      expense.expenseType === ExpenseType.EMPLOYEE_ADVANCE &&
      input.expenseType !== undefined &&
      input.expenseType !== ExpenseType.EMPLOYEE_ADVANCE
    ) {
      const originalDateStr = this.dateToISOString(expense.expenseDate);
      await this.checkPayrollLock(originalDateStr);
    }

    // Apply updates
    if (input.amount !== undefined) expense.amount = input.amount;
    if (input.description !== undefined) expense.description = input.description.trim();
    if (input.expenseDate !== undefined) expense.expenseDate = new Date(input.expenseDate);
    expense.expenseType = effectiveExpenseType;
    expense.category = effectiveCategory;
    if (input.accountId !== undefined) expense.accountId = (input.accountId || undefined) as string;
    if (input.employeeId !== undefined) expense.employeeId = (input.employeeId || undefined) as string;
    if (input.notes !== undefined) expense.notes = (input.notes || undefined) as string;

    // Stamp audit fields
    expense.updatedBy = user.id;
    expense.updatedAt = new Date();

    return this.expenseRepository.save(expense);
  }

  /**
   * Soft-delete an expense with permission and payroll lock checks
   */
  async softDelete(id: string, user: AuthenticatedUser): Promise<Expense> {
    const expense = await this.findOneOrFail(id);

    // Permission check (same as update)
    this.checkUpdatePermission(expense, user);

    // Payroll lock check for EMPLOYEE_ADVANCE
    if (expense.expenseType === ExpenseType.EMPLOYEE_ADVANCE) {
      const dateStr = this.dateToISOString(expense.expenseDate);
      await this.checkPayrollLock(dateStr);
    }

    // Stamp soft-delete fields
    expense.deletedAt = new Date();
    expense.deletedBy = user.id;

    return this.expenseRepository.save(expense);
  }

  /**
   * Find a single expense by ID (non-deleted)
   */
  async findOne(id: string): Promise<Expense | null> {
    return this.expenseRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['account', 'employee'],
    });
  }

  /**
   * List expenses with filtering, pagination, and month-based defaults
   */
  async findAll(
    query: FindAllExpensesQuery,
    user: AuthenticatedUser,
  ): Promise<FindAllExpensesResult> {
    // Validate pagination parameters
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    if (!Number.isInteger(page) || page < 1) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Page must be a positive integer >= 1',
          data: { code: 'INVALID_PAGE' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Page size must be an integer between 1 and 100',
          data: { code: 'INVALID_PAGE_SIZE' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Determine month boundaries in UTC (dates stored as DATE type)
    const { monthStart, monthEnd } = this.getMonthBoundaries(query.month);

    // Build query
    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoinAndSelect('expense.account', 'account')
      .leftJoinAndSelect('expense.employee', 'employee');

    // Soft-delete filter: exclude deleted by default
    const isSuperAdmin = user.isSuperAdmin || user.role === UserRole.SUPER_ADMIN;
    if (query.includeDeleted && isSuperAdmin) {
      // Include soft-deleted expenses for SUPER_ADMIN
    } else {
      qb.andWhere('expense.deletedAt IS NULL');
    }

    // Month filter (always applied - defaults to current IST month)
    qb.andWhere('expense.expenseDate >= :monthStart', { monthStart });
    qb.andWhere('expense.expenseDate <= :monthEnd', { monthEnd });

    // ExpenseType filter
    if (query.expenseType) {
      qb.andWhere('expense.expenseType = :expenseType', {
        expenseType: query.expenseType,
      });
    }

    // Category filter
    if (query.category) {
      qb.andWhere('expense.category = :category', {
        category: query.category,
      });
    }

    // AccountId filter
    if (query.accountId) {
      qb.andWhere('expense.accountId = :accountId', {
        accountId: query.accountId,
      });
    }

    // EmployeeId filter
    if (query.employeeId) {
      qb.andWhere('expense.employeeId = :employeeId', {
        employeeId: query.employeeId,
      });
    }

    // Search filter (case-insensitive substring match on description)
    if (query.search) {
      qb.andWhere('expense.description ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    // SUPER_USER visibility: always exclude expenses with accountId = null (Requirement 11.6)
    if (user.role === UserRole.SUPER_USER && !isSuperAdmin) {
      qb.andWhere('expense.accountId IS NOT NULL');
    }

    // Sort: expenseDate descending, then createdAt descending
    qb.orderBy('expense.expenseDate', 'DESC');
    qb.addOrderBy('expense.createdAt', 'DESC');

    // Get total count (before pagination)
    const total = await qb.getCount();

    // Get paginated data
    const data = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    // Compute monthTotal: sum of amount for all non-deleted expenses matching the filters in the requested month
    const monthTotalQb = this.expenseRepository
      .createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'monthTotal');

    // Always exclude deleted for monthTotal calculation
    monthTotalQb.andWhere('expense.deletedAt IS NULL');

    // Apply same month filter
    monthTotalQb.andWhere('expense.expenseDate >= :monthStart', { monthStart });
    monthTotalQb.andWhere('expense.expenseDate <= :monthEnd', { monthEnd });

    // Apply same non-month filters for monthTotal
    if (query.expenseType) {
      monthTotalQb.andWhere('expense.expenseType = :expenseType', {
        expenseType: query.expenseType,
      });
    }
    if (query.category) {
      monthTotalQb.andWhere('expense.category = :category', {
        category: query.category,
      });
    }
    if (query.accountId) {
      monthTotalQb.andWhere('expense.accountId = :accountId', {
        accountId: query.accountId,
      });
    }
    if (query.employeeId) {
      monthTotalQb.andWhere('expense.employeeId = :employeeId', {
        employeeId: query.employeeId,
      });
    }
    if (query.search) {
      monthTotalQb.andWhere('expense.description ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    // SUPER_USER visibility for monthTotal as well (Requirement 11.6)
    if (user.role === UserRole.SUPER_USER && !isSuperAdmin) {
      monthTotalQb.andWhere('expense.accountId IS NOT NULL');
    }

    const monthTotalResult = await monthTotalQb.getRawOne();
    const monthTotal = parseFloat(monthTotalResult?.monthTotal || '0');

    // Compute hasNextPage
    const hasNextPage = page * pageSize < total;

    return {
      data,
      page,
      pageSize,
      total,
      monthTotal,
      hasNextPage,
    };
  }

  /**
   * Get monthly expense summary with breakdowns by type and category
   */
  async getSummary(
    monthParam: string | undefined,
    user: AuthenticatedUser,
  ): Promise<{
    month: string;
    monthTotal: number;
    expenseCount: number;
    byType: { GENERAL: number; EMPLOYEE_ADVANCE: number };
    byCategory: Record<string, number>;
  }> {
    // Determine month: if "current" or undefined, use current IST month
    let monthStr: string | undefined;
    if (!monthParam || monthParam === 'current') {
      monthStr = undefined; // will default to current IST month in getMonthBoundaries
    } else {
      monthStr = monthParam;
    }

    const { monthStart, monthEnd } = this.getMonthBoundaries(monthStr);

    // Determine the month string for the response
    const responseMonth = monthStr || this.getCurrentISTMonthString();

    // Base query: non-deleted expenses in the month
    const baseQb = this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.deletedAt IS NULL')
      .andWhere('expense.expenseDate >= :monthStart', { monthStart })
      .andWhere('expense.expenseDate <= :monthEnd', { monthEnd });

    // SUPER_USER visibility: exclude expenses with accountId = null (Requirement 11.6)
    const isSuperAdmin = user.isSuperAdmin || user.role === UserRole.SUPER_ADMIN;
    if (user.role === UserRole.SUPER_USER && !isSuperAdmin) {
      baseQb.andWhere('expense.accountId IS NOT NULL');
    }

    // Get monthTotal and expenseCount
    const summaryResult = await baseQb
      .clone()
      .select('COALESCE(SUM(expense.amount), 0)', 'monthTotal')
      .addSelect('COUNT(expense.id)', 'expenseCount')
      .getRawOne();

    const monthTotal = parseFloat(summaryResult?.monthTotal || '0');
    const expenseCount = parseInt(summaryResult?.expenseCount || '0', 10);

    // Get breakdown by type
    const byTypeResults = await baseQb
      .clone()
      .select('expense.expenseType', 'expenseType')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .groupBy('expense.expenseType')
      .getRawMany();

    const byType = {
      GENERAL: 0,
      EMPLOYEE_ADVANCE: 0,
    };
    for (const row of byTypeResults) {
      if (row.expenseType === ExpenseType.GENERAL) {
        byType.GENERAL = parseFloat(row.total || '0');
      } else if (row.expenseType === ExpenseType.EMPLOYEE_ADVANCE) {
        byType.EMPLOYEE_ADVANCE = parseFloat(row.total || '0');
      }
    }

    // Get breakdown by category
    const byCategoryResults = await baseQb
      .clone()
      .select('expense.category', 'category')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .groupBy('expense.category')
      .getRawMany();

    const byCategory: Record<string, number> = {};
    // Initialize all categories to 0
    for (const cat of Object.values(ExpenseCategory)) {
      byCategory[cat] = 0;
    }
    for (const row of byCategoryResults) {
      if (row.category) {
        byCategory[row.category] = parseFloat(row.total || '0');
      }
    }

    return {
      month: responseMonth,
      monthTotal,
      expenseCount,
      byType,
      byCategory,
    };
  }

  /**
   * Get expense configuration flags
   */
  getConfig(): { accountRequired: boolean } {
    const accountRequired =
      this.configService.get<string>('EXPENSE_ACCOUNT_REQUIRED', 'false') === 'true';

    return { accountRequired };
  }

  // ─── Refund Methods ─────────────────────────────────────────────────────────

  /**
   * Create a refund for an expense with balance impact
   */
  async createRefund(
    expenseId: string,
    dto: { amount: number; refundDate: string; description: string },
    userId: string,
  ): Promise<Refund> {
    // Find the expense (reject if not found or soft-deleted)
    const expense = await this.expenseRepository.findOne({
      where: { id: expenseId },
    });

    if (!expense) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Expense not found',
          data: { code: 'EXPENSE_NOT_FOUND' },
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (expense.deletedAt) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Cannot refund a deleted expense',
          data: { code: 'EXPENSE_DELETED' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Calculate remaining refundable: expense.amount - sum of prior non-deleted refunds
    const priorRefundSumResult = await this.refundRepository
      .createQueryBuilder('refund')
      .select('COALESCE(SUM(refund.amount), 0)', 'total')
      .where('refund.expenseId = :expenseId', { expenseId })
      .andWhere('refund.deletedAt IS NULL')
      .getRawOne();
    const priorRefundTotal = parseFloat(priorRefundSumResult?.total || '0');
    const remaining = Number(expense.amount) - priorRefundTotal;

    if (dto.amount > remaining) {
      throw new HttpException(
        {
          status: 'error',
          message: `Refund amount exceeds remaining refundable amount. Remaining: ${remaining.toFixed(2)}`,
          data: {
            code: 'REFUND_EXCEEDS_REMAINING',
            details: { remaining },
          },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // If expense is EMPLOYEE_ADVANCE, check payroll lock
    if (expense.expenseType === ExpenseType.EMPLOYEE_ADVANCE) {
      const dateStr = this.dateToISOString(expense.expenseDate);
      await this.checkPayrollLock(dateStr);
    }

    // Use QueryRunner transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Persist Refund record
      const refund = queryRunner.manager.create(Refund, {
        expenseId,
        amount: dto.amount,
        refundDate: new Date(dto.refundDate),
        description: dto.description.trim(),
        createdBy: userId,
      });
      const savedRefund = await queryRunner.manager.save(Refund, refund);

      // Apply inverse balance impact if expense has accountId and account is not LOAN
      if (expense.accountId) {
        const account = await queryRunner.manager.findOne(Account, {
          where: { id: expense.accountId },
        });

        if (account && account.accountType !== AccountType.LOAN) {
          const refundAmount = Number(dto.amount);

          if (
            account.accountType === AccountType.BANK ||
            account.accountType === AccountType.CASH
          ) {
            // Asset account: INCREMENT currentBalance (money coming back)
            await queryRunner.query(
              `UPDATE account SET current_balance = current_balance + $1 WHERE id = $2`,
              [refundAmount, account.id],
            );
          } else if (
            account.accountType === AccountType.CREDIT_CARD ||
            account.accountType === AccountType.OVERDRAFT
          ) {
            // Liability account: DECREMENT currentOutstanding (reducing what's owed)
            await queryRunner.query(
              `UPDATE account SET current_outstanding = current_outstanding - $1 WHERE id = $2`,
              [refundAmount, account.id],
            );
          }
        }
      }

      await queryRunner.commitTransaction();
      return savedRefund;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * List non-deleted refunds for an expense
   */
  async findRefundsByExpense(expenseId: string): Promise<Refund[]> {
    // Verify expense exists
    const expense = await this.expenseRepository.findOne({
      where: { id: expenseId },
    });

    if (!expense) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Expense not found',
          data: { code: 'EXPENSE_NOT_FOUND' },
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return this.refundRepository.find({
      where: { expenseId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  // ─── Private Validation Methods ────────────────────────────────────────────

  private validateAmount(amount: number): void {
    if (amount === undefined || amount === null) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Amount is required',
          data: { code: 'INVALID_AMOUNT' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (amount <= 0) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Amount must be greater than 0',
          data: { code: 'INVALID_AMOUNT' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (amount > 99999999.99) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Amount must not exceed 99,999,999.99',
          data: { code: 'INVALID_AMOUNT' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check at most 2 decimal places
    const decimalStr = amount.toString();
    const decimalIndex = decimalStr.indexOf('.');
    if (decimalIndex !== -1) {
      const decimalPlaces = decimalStr.length - decimalIndex - 1;
      if (decimalPlaces > 2) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Amount must have at most 2 decimal places',
            data: { code: 'INVALID_AMOUNT' },
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  private validateDescription(description: string): void {
    if (!description || description.trim().length === 0) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Description is required and cannot be empty or whitespace only',
          data: { code: 'DESCRIPTION_REQUIRED' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const trimmed = description.trim();
    if (trimmed.length < 1 || trimmed.length > 500) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Description must be between 1 and 500 characters after trimming',
          data: { code: 'DESCRIPTION_REQUIRED' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private validateExpenseDate(expenseDate: string): void {
    const date = new Date(expenseDate);
    if (isNaN(date.getTime())) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Invalid expense date',
          data: { code: 'INVALID_EXPENSE_DATE' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Get current IST time
    const nowIST = this.getNowIST();

    // Not more than 1 day in the future (IST)
    const maxFutureDate = new Date(nowIST);
    maxFutureDate.setDate(maxFutureDate.getDate() + 1);
    maxFutureDate.setHours(23, 59, 59, 999);

    if (new Date(expenseDate) > new Date(maxFutureDate.toISOString().split('T')[0])) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Expense date cannot be more than 1 day in the future',
          data: { code: 'INVALID_EXPENSE_DATE' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Not more than 5 years in the past
    const minDate = new Date(nowIST);
    minDate.setFullYear(minDate.getFullYear() - 5);

    if (new Date(expenseDate) < new Date(minDate.toISOString().split('T')[0])) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Expense date cannot be more than 5 years in the past',
          data: { code: 'INVALID_EXPENSE_DATE' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private validateExpenseType(expenseType: ExpenseType): void {
    if (!Object.values(ExpenseType).includes(expenseType)) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Invalid expense type',
          data: { code: 'INVALID_EXPENSE_TYPE' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private resolveCategory(
    expenseType: ExpenseType,
    category?: ExpenseCategory,
  ): ExpenseCategory {
    // EMPLOYEE_ADVANCE auto-sets category to SALARY_ADVANCE if not provided
    if (expenseType === ExpenseType.EMPLOYEE_ADVANCE) {
      if (!category) {
        return ExpenseCategory.SALARY_ADVANCE;
      }
    }

    if (category && !Object.values(ExpenseCategory).includes(category)) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Invalid expense category',
          data: { code: 'INVALID_CATEGORY' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // For GENERAL type, category is required
    if (expenseType === ExpenseType.GENERAL && !category) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Category is required for general expenses',
          data: { code: 'INVALID_CATEGORY' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return category!;
  }

  private async validateEmployee(employeeId: string): Promise<void> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Employee not found',
          data: { code: 'EMPLOYEE_REQUIRED_FOR_ADVANCE' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if employee is active (isActive = false means archived/deleted)
    if (!employee.isActive) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Employee is inactive or archived',
          data: { code: 'EMPLOYEE_INACTIVE' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async validateAccountForExpense(accountId: string): Promise<void> {
    const account = await this.accountRepository.findOne({
      where: { id: accountId },
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

    // Reject LOAN accounts
    if (account.accountType === AccountType.LOAN) {
      throw new HttpException(
        {
          status: 'error',
          message: 'LOAN accounts cannot be used for expenses',
          data: { code: 'ACCOUNT_TYPE_NOT_EXPENSABLE' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private checkAccountRequired(accountId: string | null | undefined): void {
    const accountRequired =
      this.configService.get<string>('EXPENSE_ACCOUNT_REQUIRED', 'false') === 'true';

    if (accountRequired && !accountId) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Account is required for expenses',
          data: { code: 'ACCOUNT_REQUIRED' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private checkUpdatePermission(expense: Expense, user: AuthenticatedUser): void {
    // SUPER_ADMIN can update any non-deleted expense
    if (user.isSuperAdmin || user.role === UserRole.SUPER_ADMIN) {
      if (expense.deletedAt) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Cannot modify a deleted expense',
            data: { code: 'EXPENSE_DELETED' },
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      return;
    }

    // SUPER_USER can only update own expenses
    if (user.role === UserRole.SUPER_USER) {
      if (expense.deletedAt) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Cannot modify a deleted expense',
            data: { code: 'EXPENSE_DELETED' },
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (expense.createdBy !== user.id) {
        throw new HttpException(
          {
            status: 'error',
            message: 'You can only modify your own expenses',
            data: { code: 'EXPENSE_NOT_OWNED' },
          },
          HttpStatus.FORBIDDEN,
        );
      }
      return;
    }

    // Other roles cannot update
    throw new ForbiddenException('Access denied');
  }

  private async checkPayrollLock(expenseDateStr: string): Promise<void> {
    // Determine the IST month of the expense date
    const expenseDate = new Date(expenseDateStr);
    const istDate = this.toISTDate(expenseDate);
    const year = istDate.getFullYear();
    const month = istDate.getMonth(); // 0-indexed

    // Find a PayrollRun for this month that is LOCKED
    // PayrollRun.runForMonth is stored as a date representing the first of the month
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    const lockedPayroll = await this.payrollRunRepository
      .createQueryBuilder('pr')
      .where('pr.status = :status', { status: PayrollStatus.LOCKED })
      .andWhere('pr.runForMonth >= :monthStart', { monthStart })
      .andWhere('pr.runForMonth <= :monthEnd', { monthEnd })
      .getOne();

    if (lockedPayroll) {
      const lockedMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
      throw new HttpException(
        {
          status: 'error',
          message: `Cannot modify Employee Advance in a locked payroll month (${lockedMonth})`,
          data: {
            code: 'PAYROLL_LOCKED',
            details: { lockedMonth },
          },
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  private async findOneOrFail(id: string): Promise<Expense> {
    const expense = await this.expenseRepository.findOne({
      where: { id },
    });

    if (!expense) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Expense not found',
          data: { code: 'EXPENSE_NOT_FOUND' },
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return expense;
  }

  // ─── Date Utility Methods ──────────────────────────────────────────────────

  /**
   * Get the start and end dates for a given month in IST, converted to UTC date strings.
   * Since expenseDate is stored as DATE type (YYYY-MM-DD), we just need the date boundaries.
   * IST month boundaries:
   *   Start: first day of month at 00:00:00 IST
   *   End: last day of month at 23:59:59 IST
   * Since DATE type stores just the date portion, we use the first and last day of the month.
   */
  private getMonthBoundaries(month?: string): { monthStart: string; monthEnd: string } {
    let year: number;
    let monthIndex: number; // 0-indexed

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [yearStr, monthStr] = month.split('-');
      year = parseInt(yearStr, 10);
      monthIndex = parseInt(monthStr, 10) - 1; // Convert to 0-indexed
    } else {
      // Default to current IST month
      const nowIST = this.getNowIST();
      year = nowIST.getFullYear();
      monthIndex = nowIST.getMonth();
    }

    // First day of the month (YYYY-MM-DD)
    const monthStart = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;

    // Last day of the month
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const monthEnd = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    return { monthStart, monthEnd };
  }

  private getNowIST(): Date {
    // Get current time in IST (UTC+5:30)
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const istMs = utcMs + 5.5 * 60 * 60 * 1000;
    return new Date(istMs);
  }

  private getCurrentISTMonthString(): string {
    const nowIST = this.getNowIST();
    const year = nowIST.getFullYear();
    const month = nowIST.getMonth() + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  private toISTDate(date: Date): Date {
    const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
    const istMs = utcMs + 5.5 * 60 * 60 * 1000;
    return new Date(istMs);
  }

  private dateToISOString(date: Date): string {
    // Convert a Date to YYYY-MM-DD string
    if (typeof date === 'string') return date;
    return new Date(date).toISOString().split('T')[0];
  }
}
