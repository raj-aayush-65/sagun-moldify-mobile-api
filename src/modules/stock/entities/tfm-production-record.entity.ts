import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Shift } from '../enums/shift.enum';
import { TfmRollConsumption } from './tfm-roll-consumption.entity';
import { TfmProductionOutput } from './tfm-production-output.entity';

@Entity('tfm_production_record')
export class TfmProductionRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'enum', enum: Shift })
  shift: Shift;

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
  @OneToMany(() => TfmRollConsumption, consumption => consumption.tfmProductionRecord)
  rollConsumptions: TfmRollConsumption[];

  @OneToMany(() => TfmProductionOutput, output => output.tfmProductionRecord)
  productionOutputs: TfmProductionOutput[];
}
