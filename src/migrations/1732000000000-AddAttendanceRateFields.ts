import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAttendanceRateFields1732000000000 implements MigrationInterface {
  name = 'AddAttendanceRateFields1732000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add per_visit_rate column for OCCASIONAL employees (skip if exists)
    await queryRunner.query(`
      DO $
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'attendance' AND column_name = 'per_visit_rate'
        ) THEN
          ALTER TABLE "attendance" ADD "per_visit_rate" decimal(10,2);
        END IF;
      END $
    `);

    // Add per_cup_rate column for PICKER employees (legacy) (skip if exists)
    await queryRunner.query(`
      DO $
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'attendance' AND column_name = 'per_cup_rate'
        ) THEN
          ALTER TABLE "attendance" ADD "per_cup_rate" decimal(10,2);
        END IF;
      END $
    `);

    // Add cups_count column for PICKER employees (skip if exists)
    await queryRunner.query(`
      DO $
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'attendance' AND column_name = 'cups_count'
        ) THEN
          ALTER TABLE "attendance" ADD "cups_count" decimal(12,2);
        END IF;
      END $
    `);

    // Add cups_unit column for PICKER employees (skip if exists)
    await queryRunner.query(`
      DO $
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'attendance' AND column_name = 'cups_unit'
        ) THEN
          ALTER TABLE "attendance" ADD "cups_unit" VARCHAR(20);
        END IF;
      END $
    `);

    // Add cups_rate column for PICKER employees (skip if exists)
    await queryRunner.query(`
      DO $
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'attendance' AND column_name = 'cups_rate'
        ) THEN
          ALTER TABLE "attendance" ADD "cups_rate" decimal(10,2);
        END IF;
      END $
    `);

    // Add cups_rate_unit column for PICKER employees (skip if exists)
    await queryRunner.query(`
      DO $
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'attendance' AND column_name = 'cups_rate_unit'
        ) THEN
          ALTER TABLE "attendance" ADD "cups_rate_unit" VARCHAR(20);
        END IF;
      END $
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('attendance', 'cups_rate_unit');
    await queryRunner.dropColumn('attendance', 'cups_rate');
    await queryRunner.dropColumn('attendance', 'cups_unit');
    await queryRunner.dropColumn('attendance', 'cups_count');
    await queryRunner.dropColumn('attendance', 'per_cup_rate');
    await queryRunner.dropColumn('attendance', 'per_visit_rate');
  }
}
