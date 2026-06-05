import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { RollStatus } from '../enums/roll-status.enum';
import { TfmProductionRecord } from './tfm-production-record.entity';
import { Roll } from './roll.entity';

@Entity('tfm_roll_consumption')
export class TfmRollConsumption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tfm_production_record_id' })
  tfmProductionRecordId: string;

  @Column({ name: 'roll_id' })
  rollId: string;

  @Column({ name: 'roll_weight', type: 'decimal', precision: 10, scale: 3 })
  rollWeight: number;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  wastage: number;

  @Column({ name: 'shift_end_status', type: 'enum', enum: RollStatus })
  shiftEndStatus: RollStatus;

  @Column({ name: 'remaining_weight', type: 'decimal', precision: 10, scale: 3, nullable: true })
  remainingWeight: number;

  @Column({ name: 'weight_mismatch', type: 'boolean', default: false })
  weightMismatch: boolean;

  @Column({ length: 500, nullable: true })
  remarks: string;

  // Relations
  @ManyToOne(() => TfmProductionRecord, record => record.rollConsumptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tfm_production_record_id' })
  tfmProductionRecord: TfmProductionRecord;

  @ManyToOne(() => Roll, roll => roll.tfmConsumptions)
  @JoinColumn({ name: 'roll_id' })
  roll: Roll;
}
