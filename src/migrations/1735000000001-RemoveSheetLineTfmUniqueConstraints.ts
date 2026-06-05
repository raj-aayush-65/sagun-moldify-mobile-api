import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveSheetLineTfmUniqueConstraints1735000000001 implements MigrationInterface {
  name = 'RemoveSheetLineTfmUniqueConstraints1735000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove unique constraint on sheet_line_report(date, shift) - multiple reports per shift allowed
    await queryRunner.query(
      `ALTER TABLE "sheet_line_report" DROP CONSTRAINT IF EXISTS "uq_sheet_line_report_date_shift";`
    );

    // Remove unique constraint on tfm_production_record(date, shift) - multiple records per shift allowed
    await queryRunner.query(
      `ALTER TABLE "tfm_production_record" DROP CONSTRAINT IF EXISTS "uq_tfm_production_record_date_shift";`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add unique constraints
    await queryRunner.query(
      `ALTER TABLE "sheet_line_report" ADD CONSTRAINT "uq_sheet_line_report_date_shift" UNIQUE ("date", "shift");`
    );
    await queryRunner.query(
      `ALTER TABLE "tfm_production_record" ADD CONSTRAINT "uq_tfm_production_record_date_shift" UNIQUE ("date", "shift");`
    );
  }
}
