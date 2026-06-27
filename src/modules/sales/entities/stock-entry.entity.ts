import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BoxVariant } from './box-variant.entity';

@Entity('stock_entry')
export class StockEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'box_variant_id' })
  boxVariantId: string;

  @ManyToOne(() => BoxVariant)
  @JoinColumn({ name: 'box_variant_id' })
  boxVariant: BoxVariant;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'entry_date', type: 'date' })
  entryDate: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
