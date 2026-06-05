import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SheetLineReport } from './sheet-line-report.entity';
import { WastageCategory } from '../enums/wastage-category.enum';

@Entity('sheet_line_wastage')
export class SheetLineWastage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sheet_line_report_id' })
  sheetLineReportId: string;

  @Column({ name: 'wastage_category', type: 'enum', enum: WastageCategory })
  wastageCategory: WastageCategory;

  @Column({ name: 'weight', type: 'decimal', precision: 10, scale: 2 })
  weight: number;

  // Relations
  @ManyToOne(() => SheetLineReport, report => report.wastages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sheet_line_report_id' })
  sheetLineReport: SheetLineReport;
}
