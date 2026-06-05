import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TfmProductionRecord } from './tfm-production-record.entity';
import { Product } from './product.entity';

@Entity('tfm_production_output')
export class TfmProductionOutput {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tfm_production_record_id' })
  tfmProductionRecordId: string;

  @Column({ name: 'product_id' })
  productId: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'loose_count', type: 'int', default: 0 })
  looseCount: number;

  @Column({ name: 'total_boxes', type: 'int' })
  totalBoxes: number;

  @Column({ name: 'loose_cups', type: 'int' })
  looseCups: number;

  // Relations
  @ManyToOne(() => TfmProductionRecord, record => record.productionOutputs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tfm_production_record_id' })
  tfmProductionRecord: TfmProductionRecord;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
