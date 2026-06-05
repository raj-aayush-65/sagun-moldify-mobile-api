import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('product')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 50 })
  size: string;

  @Column({ length: 50 })
  volume: string;

  @Column({ length: 50 })
  colour: string;

  @Column({ name: 'weight_per_cup', type: 'decimal', precision: 5, scale: 2 })
  weightPerCup: number;

  @Column({ name: 'quantity_per_box', type: 'int' })
  quantityPerBox: number;

  @Column({
    name: 'selling_price_per_box',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  sellingPricePerBox: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  // Audit columns
  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
