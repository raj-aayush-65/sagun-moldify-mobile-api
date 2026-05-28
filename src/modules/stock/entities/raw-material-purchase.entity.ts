import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RawMaterialType } from './raw-material-type.entity';

@Entity('raw_material_purchase')
export class RawMaterialPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'material_type_id' })
  materialTypeId: string;

  @Column({ name: 'vendor_name', length: 200 })
  vendorName: string;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  quantity: number;

  @Column({ name: 'price_per_kg', type: 'decimal', precision: 14, scale: 2 })
  pricePerKg: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 14, scale: 2 })
  totalPrice: number;

  @Column({ name: 'purchase_date', type: 'date' })
  purchaseDate: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

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
  @ManyToOne(() => RawMaterialType, materialType => materialType.purchases)
  @JoinColumn({ name: 'material_type_id' })
  materialType: RawMaterialType;
}
