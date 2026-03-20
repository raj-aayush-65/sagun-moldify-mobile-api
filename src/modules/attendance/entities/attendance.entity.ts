import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  HALF_DAY = 'HALF_DAY',
  HOLIDAY = 'HOLIDAY',
  LEAVE = 'LEAVE',
  WORKING = 'WORKING', // For working on Monday (which is a holiday)
}

export enum ShiftType {
  DAY_SHIFT = 'DAY_SHIFT',
  NIGHT_SHIFT = 'NIGHT_SHIFT',
}

export enum CupsUnit {
  PER_100 = 'PER_100',
  PER_THOUSAND = 'PER_THOUSAND',
  PER_10_THOUSAND = 'PER_10_THOUSAND',
}

@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'employee_id' })
  employeeId: string;

  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate: Date;

  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    default: AttendanceStatus.PRESENT,
  })
  status: AttendanceStatus;

  @Column({
    type: 'enum',
    enum: ShiftType,
    default: ShiftType.DAY_SHIFT,
  })
  shift: ShiftType;

  @Column({ name: 'is_holiday_worked', default: false })
  isHolidayWorked: boolean;

  @Column({ name: 'balance_date', type: 'date', nullable: true })
  balanceDate: Date;

  @Column({ name: 'overtime_multiplier', type: 'decimal', precision: 3, scale: 2, default: 1.0 })
  overtimeMultiplier: number;

  // For OCCASIONAL employees - rate per visit
  @Column({ name: 'per_visit_rate', type: 'decimal', precision: 10, scale: 2, nullable: true })
  perVisitRate: number;

  // For PICKER employees - legacy rate per cup
  @Column({ name: 'per_cup_rate', type: 'decimal', precision: 10, scale: 2, nullable: true })
  perCupRate: number;

  // For PICKER employees - cups count (in selected unit)
  @Column({ name: 'cups_count', type: 'decimal', precision: 12, scale: 2, nullable: true })
  cupsCount: number;

  // For PICKER employees - cups unit (PER_100, PER_THOUSAND, PER_10_THOUSAND)
  @Column({
    name: 'cups_unit',
    type: 'enum',
    enum: CupsUnit,
    nullable: true,
  })
  cupsUnit: CupsUnit;

  // For PICKER employees - rate per selected unit
  @Column({ name: 'cups_rate', type: 'decimal', precision: 10, scale: 2, nullable: true })
  cupsRate: number;

  // For PICKER employees - rate unit (can be different from cups unit)
  @Column({
    name: 'cups_rate_unit',
    type: 'enum',
    enum: CupsUnit,
    nullable: true,
  })
  cupsRateUnit: CupsUnit;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
