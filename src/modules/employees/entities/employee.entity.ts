import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum EmployeeType {
  PERMANENT = 'PERMANENT',
  OCCASIONAL = 'OCCASIONAL',
  PICKER = 'PICKER',
}

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  RESIGNED = 'RESIGNED',
}

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100 })
  designation: string;

  @Column({
    name: 'employee_type',
    type: 'enum',
    enum: EmployeeType,
    default: EmployeeType.PERMANENT,
  })
  employeeType: EmployeeType;

  @Column({
    name: 'status',
    type: 'enum',
    enum: EmployeeStatus,
    default: EmployeeStatus.ACTIVE,
  })
  status: EmployeeStatus;

  @Column({
    name: 'monthly_salary',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  monthlySalary: number;

  @Column({
    name: 'daily_rate',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  dailyRate: number;

  // Basic Details (Optional)
  @Column({ nullable: true })
  email: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ name: 'date_of_birth', nullable: true })
  dateOfBirth: Date;

  @Column({ nullable: true })
  address: string;

  // ID/Document Details (Optional)
  @Column({ name: 'pan_number', length: 10, nullable: true })
  panNumber: string;

  @Column({ name: 'aadhar_number', length: 12, nullable: true })
  aadharNumber: string;

  @Column({ name: 'uan_number', length: 12, nullable: true })
  uanNumber: string;

  @Column({ name: 'bank_account_number', nullable: true })
  bankAccountNumber: string;

  @Column({ name: 'bank_name', nullable: true })
  bankName: string;

  @Column({ name: 'ifsc_code', length: 11, nullable: true })
  ifscCode: string;

  @Column({ name: 'emergency_contact_name', nullable: true })
  emergencyContactName: string;

  @Column({ name: 'emergency_contact_phone', length: 20, nullable: true })
  emergencyContactPhone: string;

  // System Fields
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: Employee;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
