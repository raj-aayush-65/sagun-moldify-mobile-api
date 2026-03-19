import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PayrollRun } from './payroll-run.entity';
import { Employee } from '../../employees/entities/employee.entity';

export enum PayrollEntryStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
}

@Entity('payroll_entry')
export class PayrollEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PayrollRun, (payrollRun: PayrollRun) => payrollRun.entries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'payroll_run_id' })
  payrollRun: PayrollRun;

  @Column({ name: 'payroll_run_id' })
  payrollRunId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'employee_id' })
  employeeId: string;

  @Column({ name: 'working_days', type: 'decimal', precision: 5, scale: 2 })
  workingDays: number;

  @Column({ name: 'daily_rate', type: 'decimal', precision: 10, scale: 2 })
  dailyRate: number;

  @Column({ name: 'base_salary', type: 'decimal', precision: 12, scale: 2 })
  baseSalary: number;

  @Column({ name: 'overtime_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  overtimeAmount: number;

  @Column({ name: 'overtime_days', type: 'decimal', precision: 5, scale: 2, default: 0 })
  overtimeDays: number;

  @Column({ name: 'overtime_multiplier', type: 'decimal', precision: 3, scale: 2, default: 1.0 })
  overtimeMultiplier: number;

  @Column({ name: 'half_days_deduction', type: 'decimal', precision: 12, scale: 2, default: 0 })
  halfDaysDeduction: number;

  @Column({ name: 'half_day_count', type: 'decimal', precision: 5, scale: 2, default: 0 })
  halfDayCount: number;

  @Column({ name: 'gross_salary', type: 'decimal', precision: 12, scale: 2 })
  grossSalary: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  deductions: number;

  @Column({ name: 'net_salary', type: 'decimal', precision: 12, scale: 2 })
  netSalary: number;

  @Column({
    type: 'enum',
    enum: PayrollEntryStatus,
    default: PayrollEntryStatus.PENDING,
  })
  status: PayrollEntryStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
