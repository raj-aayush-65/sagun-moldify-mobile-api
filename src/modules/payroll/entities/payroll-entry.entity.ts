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

// Transformer to convert decimal strings to numbers (for database <-> entity)
const numberTransformer = {
  to: (value: number): number => value,
  from: (value: any): number => {
    if (value === null || value === undefined) return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  },
};

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

  @Column({
    name: 'working_days',
    type: 'decimal',
    precision: 5,
    scale: 2,
    transformer: numberTransformer,
  })
  workingDays: number;

  @Column({
    name: 'daily_rate',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: numberTransformer,
  })
  dailyRate: number;

  @Column({
    name: 'base_salary',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: numberTransformer,
  })
  baseSalary: number;

  @Column({
    name: 'overtime_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numberTransformer,
  })
  overtimeAmount: number;

  @Column({
    name: 'overtime_days',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: numberTransformer,
  })
  overtimeDays: number;

  @Column({
    name: 'overtime_multiplier',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 1.0,
    transformer: numberTransformer,
  })
  overtimeMultiplier: number;

  @Column({
    name: 'half_days_deduction',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numberTransformer,
  })
  halfDaysDeduction: number;

  @Column({
    name: 'half_day_count',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: numberTransformer,
  })
  halfDayCount: number;

  @Column({
    name: 'gross_salary',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: numberTransformer,
  })
  grossSalary: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: numberTransformer })
  deductions: number;

  @Column({
    name: 'net_salary',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: numberTransformer,
  })
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
