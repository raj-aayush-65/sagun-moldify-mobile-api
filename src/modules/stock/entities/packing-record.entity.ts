import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Shift } from '../enums/shift.enum';
import { Party } from './party.entity';
import { Product } from './product.entity';
import { Invoice } from './invoice.entity';

@Entity('packing_record')
export class PackingRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'enum', enum: Shift })
  shift: Shift;

  @Column({ name: 'party_id' })
  partyId: string;

  @Column({ name: 'product_id' })
  productId: string;

  @Column({ name: 'box_count', type: 'int' })
  boxCount: number;

  @Column({ name: 'loose_cups', type: 'int', default: 0 })
  looseCups: number;

  @Column({ name: 'total_cups', type: 'int' })
  totalCups: number;

  @Column({ name: 'invoice_id', nullable: true })
  invoiceId: string;

  // Soft-delete fields
  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date;

  @Column({ name: 'deleted_by', nullable: true })
  deletedBy: string;

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

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Invoice)
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;
}
