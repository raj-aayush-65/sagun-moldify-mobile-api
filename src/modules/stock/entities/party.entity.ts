import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('party')
export class Party {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ name: 'contact_info', length: 500, nullable: true })
  contactInfo: string;

  @Column({ name: 'gst_number', length: 15, nullable: true })
  gstNumber: string;

  @Column({ length: 500, nullable: true })
  address: string;

  @Column({ length: 15, nullable: true })
  phone: string;

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
