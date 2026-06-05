import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { RollStatus } from '../enums/roll-status.enum';
import { SheetLineReport } from './sheet-line-report.entity';
import { TfmRollConsumption } from './tfm-roll-consumption.entity';

@Entity('roll')
export class Roll {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'roll_no', length: 50, unique: true })
  rollNo: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'sheet_line_report_id' })
  sheetLineReportId: string;

  @ManyToOne(() => SheetLineReport)
  @JoinColumn({ name: 'sheet_line_report_id' })
  sheetLineReport: SheetLineReport;

  @Column({ type: 'decimal', precision: 4, scale: 1 })
  thickness: number;

  @Column({ type: 'decimal', precision: 6, scale: 1 })
  width: number;

  @Column({ length: 30 })
  colour: string;

  @Column({ name: 'gross_weight', type: 'decimal', precision: 10, scale: 3 })
  grossWeight: number;

  @Column({ name: 'core_weight', type: 'decimal', precision: 10, scale: 3 })
  coreWeight: number;

  @Column({ name: 'net_weight', type: 'decimal', precision: 10, scale: 3 })
  netWeight: number;

  @Column({ type: 'enum', enum: RollStatus, default: RollStatus.AVAILABLE })
  status: RollStatus;

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
  @OneToMany(() => TfmRollConsumption, consumption => consumption.roll)
  tfmConsumptions: TfmRollConsumption[];
}
