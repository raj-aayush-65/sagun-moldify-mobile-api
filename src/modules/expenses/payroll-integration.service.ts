import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { PayrollRun, PayrollStatus } from '../payroll/entities/payroll-run.entity';
import { PayrollEntry } from '../payroll/entities/payroll-entry.entity';
import { ExpenseType } from './enums/expense-type.enum';

export interface EmployeeAdvancesResult {
  items: Expense[];
  totalAdvance: number;
  carryForwardIn: number;
  carryForwardOut: number;
  netDeductedFromPayroll: number;
}

@Injectable()
export class PayrollIntegrationService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(PayrollRun)
    private readonly payrollRunRepository: Repository<PayrollRun>,
    @InjectRepository(PayrollEntry)
    private readonly payrollEntryRepository: Repository<PayrollEntry>
  ) {}

  /**
   * Compute the total of non-deleted Employee Advances for an employee in a given month.
   * month format: YYYY-MM
   */
  async computeMonthAdvanceTotal(employeeId: string, month: string): Promise<number> {
    const { monthStart, monthEnd } = this.getMonthBoundaries(month);

    const result = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.employeeId = :employeeId', { employeeId })
      .andWhere('expense.expenseType = :expenseType', { expenseType: ExpenseType.EMPLOYEE_ADVANCE })
      .andWhere('expense.deletedAt IS NULL')
      .andWhere('expense.expenseDate >= :monthStart', { monthStart })
      .andWhere('expense.expenseDate <= :monthEnd', { monthEnd })
      .getRawOne();

    return parseFloat(result?.total || '0');
  }

  /**
   * Get the carryForwardOut from the most recent PayrollEntry for this employee
   * from the prior month. Returns 0 if no prior entry exists.
   */
  async getCarryForwardIn(employeeId: string, month: string): Promise<number> {
    const priorMonth = this.getPriorMonth(month);
    const { monthStart, monthEnd } = this.getMonthBoundaries(priorMonth);

    // Find the PayrollRun for the prior month
    const priorRun = await this.payrollRunRepository
      .createQueryBuilder('run')
      .where('run.runForMonth >= :monthStart', { monthStart })
      .andWhere('run.runForMonth <= :monthEnd', { monthEnd })
      .orderBy('run.createdAt', 'DESC')
      .getOne();

    if (!priorRun) {
      return 0;
    }

    // Find the PayrollEntry for this employee in that run
    const entry = await this.payrollEntryRepository.findOne({
      where: {
        payrollRunId: priorRun.id,
        employeeId,
      },
    });

    return entry ? Number(entry.carryForwardOut) : 0;
  }

  /**
   * Recompute the PayrollEntry for an employee in a given month.
   * Called when an Employee Advance is created/updated/deleted and payroll is DRAFT or PROCESSED.
   */
  async recomputePayrollEntry(employeeId: string, month: string): Promise<PayrollEntry | null> {
    const { monthStart, monthEnd } = this.getMonthBoundaries(month);

    // Find the PayrollRun for this month that is DRAFT or PROCESSED
    const payrollRun = await this.payrollRunRepository
      .createQueryBuilder('run')
      .where('run.runForMonth >= :monthStart', { monthStart })
      .andWhere('run.runForMonth <= :monthEnd', { monthEnd })
      .andWhere('run.status IN (:...statuses)', {
        statuses: [PayrollStatus.DRAFT, PayrollStatus.PROCESSED],
      })
      .orderBy('run.createdAt', 'DESC')
      .getOne();

    if (!payrollRun) {
      return null;
    }

    // Compute monthAdvanceTotal
    const monthAdvanceTotal = await this.computeMonthAdvanceTotal(employeeId, month);

    // Get carryForwardIn from prior month
    const carryForwardIn = await this.getCarryForwardIn(employeeId, month);

    // totalDeduction = monthAdvanceTotal + carryForwardIn
    const totalDeduction = monthAdvanceTotal + carryForwardIn;

    // Find or create the PayrollEntry for this employee in this PayrollRun
    const entry = await this.payrollEntryRepository.findOne({
      where: {
        payrollRunId: payrollRun.id,
        employeeId,
      },
    });

    if (!entry) {
      // If no entry exists, we cannot create one without salary info
      // Return null - the payroll run should have already created entries
      return null;
    }

    const grossSalary = Number(entry.grossSalary);

    // Set advancesDeducted
    entry.advancesDeducted = totalDeduction;
    entry.carryForwardIn = carryForwardIn;

    // Compute carryForwardOut and netSalary
    if (totalDeduction > grossSalary) {
      entry.carryForwardOut = totalDeduction - grossSalary;
      entry.netSalary = 0;
      entry.deductions = Number(entry.halfDaysDeduction) + totalDeduction;
    } else {
      entry.carryForwardOut = 0;
      // netSalary = grossSalary - existing deductions (halfDaysDeduction) - totalDeduction
      entry.deductions = Number(entry.halfDaysDeduction) + totalDeduction;
      entry.netSalary = grossSalary - entry.deductions;
      if (entry.netSalary < 0) {
        entry.netSalary = 0;
      }
    }

    // Save the updated entry
    return this.payrollEntryRepository.save(entry);
  }

  /**
   * Get employee advances summary for a given month.
   * Returns items, totalAdvance, carryForwardIn, carryForwardOut, netDeductedFromPayroll.
   */
  async getEmployeeAdvances(employeeId: string, month: string): Promise<EmployeeAdvancesResult> {
    const { monthStart, monthEnd } = this.getMonthBoundaries(month);

    // Get all non-deleted EMPLOYEE_ADVANCE expenses for this employee in this month
    const items = await this.expenseRepository.find({
      where: {
        employeeId,
        expenseType: ExpenseType.EMPLOYEE_ADVANCE,
        deletedAt: IsNull(),
      },
      order: { expenseDate: 'DESC', createdAt: 'DESC' },
    });

    // Filter by month (since Between doesn't work well with date type in all cases)
    const filteredItems = items.filter(item => {
      const dateStr = this.dateToString(item.expenseDate);
      return dateStr >= monthStart && dateStr <= monthEnd;
    });

    // totalAdvance: sum of amounts
    const totalAdvance = filteredItems.reduce((sum, item) => sum + Number(item.amount), 0);

    // carryForwardIn: from prior month's PayrollEntry
    const carryForwardIn = await this.getCarryForwardIn(employeeId, month);

    // carryForwardOut: from this month's PayrollEntry (or computed)
    let carryForwardOut = 0;
    const { monthStart: thisMonthStart, monthEnd: thisMonthEnd } = this.getMonthBoundaries(month);

    const currentRun = await this.payrollRunRepository
      .createQueryBuilder('run')
      .where('run.runForMonth >= :monthStart', { monthStart: thisMonthStart })
      .andWhere('run.runForMonth <= :monthEnd', { monthEnd: thisMonthEnd })
      .orderBy('run.createdAt', 'DESC')
      .getOne();

    if (currentRun) {
      const entry = await this.payrollEntryRepository.findOne({
        where: {
          payrollRunId: currentRun.id,
          employeeId,
        },
      });

      if (entry) {
        carryForwardOut = Number(entry.carryForwardOut);
      } else {
        // Compute: if no entry, compute based on available data
        const totalDeduction = totalAdvance + carryForwardIn;
        // Without grossSalary info, carryForwardOut is the full deduction
        carryForwardOut = totalDeduction;
      }
    } else {
      // No payroll run for this month - compute carryForwardOut
      // Without a payroll entry, we can't know grossSalary, so carryForwardOut = 0
      carryForwardOut = 0;
    }

    // netDeductedFromPayroll: min(totalAdvance + carryForwardIn, grossSalary)
    let netDeductedFromPayroll = totalAdvance + carryForwardIn;
    if (currentRun) {
      const entry = await this.payrollEntryRepository.findOne({
        where: {
          payrollRunId: currentRun.id,
          employeeId,
        },
      });

      if (entry) {
        const grossSalary = Number(entry.grossSalary);
        netDeductedFromPayroll = Math.min(totalAdvance + carryForwardIn, grossSalary);
      }
    }

    return {
      items: filteredItems,
      totalAdvance,
      carryForwardIn,
      carryForwardOut,
      netDeductedFromPayroll,
    };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Get month boundaries as date strings (YYYY-MM-DD)
   */
  private getMonthBoundaries(month: string): { monthStart: string; monthEnd: string } {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const mon = parseInt(monthStr, 10);

    const monthStart = `${year}-${String(mon).padStart(2, '0')}-01`;
    const lastDay = new Date(year, mon, 0).getDate();
    const monthEnd = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    return { monthStart, monthEnd };
  }

  /**
   * Get the prior month in YYYY-MM format
   */
  private getPriorMonth(month: string): string {
    const [yearStr, monthStr] = month.split('-');
    let year = parseInt(yearStr, 10);
    let mon = parseInt(monthStr, 10);

    mon -= 1;
    if (mon < 1) {
      mon = 12;
      year -= 1;
    }

    return `${year}-${String(mon).padStart(2, '0')}`;
  }

  /**
   * Convert a Date to YYYY-MM-DD string
   */
  private dateToString(date: Date): string {
    if (typeof date === 'string') {
      // If it's already a string (from DB date type), extract just the date part
      return (date as string).substring(0, 10);
    }
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  /**
   * Get current IST month as YYYY-MM string
   */
  getCurrentISTMonth(): string {
    const now = new Date();
    // IST is UTC+5:30
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const year = istNow.getUTCFullYear();
    const month = istNow.getUTCMonth() + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  }
}
