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

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
