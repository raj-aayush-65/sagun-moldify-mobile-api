import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SheetLineReport } from './sheet-line-report.entity';
import { RawMaterialType } from './raw-material-type.entity';

@Entity('sheet_line_mix_ratio')
export class SheetLineMixRatio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sheet_line_report_id' })
  sheetLineReportId: string;

  @Column({ name: 'material_type_id' })
  materialTypeId: string;

  @Column({ name: 'proportion', type: 'decimal', precision: 5, scale: 2 })
  proportion: number;

  // Relations
  @ManyToOne(() => SheetLineReport, report => report.mixRatios, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sheet_line_report_id' })
  sheetLineReport: SheetLineReport;

  @ManyToOne(() => RawMaterialType)
  @JoinColumn({ name: 'material_type_id' })
  materialType: RawMaterialType;
}
