import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccountType } from '../enums/account-type.enum';
import { AccountStatus } from '../enums/account-status.enum';

@Entity('account')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'account_type', type: 'enum', enum: AccountType })
  accountType: AccountType;

  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.ACTIVE })
  status: AccountStatus;

  @Column({ name: 'last4', length: 4, nullable: true })
  last4: string;

  @Column({ name: 'opening_balance', type: 'decimal', precision: 14, scale: 2, nullable: true })
  openingBalance: number;

  @Column({ name: 'current_balance', type: 'decimal', precision: 14, scale: 2, nullable: true })
  currentBalance: number;

  @Column({ name: 'current_outstanding', type: 'decimal', precision: 14, scale: 2, nullable: true })
  currentOutstanding: number;

  @Column({ name: 'credit_limit', type: 'decimal', precision: 14, scale: 2, nullable: true })
  creditLimit: number;

  @Column({ name: 'overdraft_limit', type: 'decimal', precision: 14, scale: 2, nullable: true })
  overdraftLimit: number;

  @Column({
    name: 'principal_outstanding',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  principalOutstanding: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Audit columns
  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_by', nullable: true })
  deletedBy: string;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date;
}
