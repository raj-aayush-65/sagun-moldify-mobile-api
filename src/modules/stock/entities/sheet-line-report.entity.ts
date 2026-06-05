import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Shift } from '../enums/shift.enum';
import { SheetLineMaterialUsage } from './sheet-line-material-usage.entity';
import { SheetLineMixRatio } from './sheet-line-mix-ratio.entity';
import { SheetLineWastage } from './sheet-line-wastage.entity';

@Entity('sheet_line_report')
export class SheetLineReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'date', type: 'date' })
  date: string;

  @Column({ name: 'shift', type: 'enum', enum: Shift })
  shift: Shift;

  @Column({ name: 'remarks', type: 'varchar', length: 500, nullable: true })
  remarks: string;

  @Column({ name: 'reconciliation_warning', type: 'boolean', default: false })
  reconciliationWarning: boolean;

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
  @OneToMany(() => SheetLineMaterialUsage, usage => usage.sheetLineReport)
  materialUsages: SheetLineMaterialUsage[];

  @OneToMany(() => SheetLineMixRatio, ratio => ratio.sheetLineReport)
  mixRatios: SheetLineMixRatio[];

  @OneToMany(() => SheetLineWastage, wastage => wastage.sheetLineReport)
  wastages: SheetLineWastage[];
}
