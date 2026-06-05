import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SheetLineReport } from './sheet-line-report.entity';
import { RawMaterialType } from './raw-material-type.entity';

@Entity('sheet_line_material_usage')
export class SheetLineMaterialUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sheet_line_report_id' })
  sheetLineReportId: string;

  @Column({ name: 'material_type_id' })
  materialTypeId: string;

  @Column({ name: 'quantity_used', type: 'decimal', precision: 10, scale: 2 })
  quantityUsed: number;

  // Relations
  @ManyToOne(() => SheetLineReport, report => report.materialUsages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sheet_line_report_id' })
  sheetLineReport: SheetLineReport;

  @ManyToOne(() => RawMaterialType)
  @JoinColumn({ name: 'material_type_id' })
  materialType: RawMaterialType;
}
