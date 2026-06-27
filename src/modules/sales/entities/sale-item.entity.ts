import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Sale } from './sale.entity';
import { BoxVariant } from './box-variant.entity';

@Entity('sale_item')
export class SaleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sale_id' })
  saleId: string;

  @ManyToOne(() => Sale, sale => sale.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @Column({ name: 'box_variant_id' })
  boxVariantId: string;

  @ManyToOne(() => BoxVariant)
  @JoinColumn({ name: 'box_variant_id' })
  boxVariant: BoxVariant;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'price_per_box', type: 'decimal', precision: 14, scale: 2, nullable: true })
  pricePerBox: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
