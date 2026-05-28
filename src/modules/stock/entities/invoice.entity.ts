import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Party } from './party.entity';

@Entity('invoice')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_number', length: 50, nullable: true })
  invoiceNumber: string;

  @Column({ name: 'party_id' })
  partyId: string;

  @Column({ name: 'account_id', nullable: true })
  accountId: string;

  @Column({ name: 'invoice_date', type: 'date', nullable: true })
  invoiceDate: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 14, scale: 2, nullable: true })
  totalAmount: number;

  @Column({ length: 20, nullable: true })
  status: string;

  // Audit columns
  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Party)
  @JoinColumn({ name: 'party_id' })
  party: Party;
}
