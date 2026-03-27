import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateAttendanceUniqueConstraint1733000000000 implements MigrationInterface {
  name = 'UpdateAttendanceUniqueConstraint1733000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old unique constraint on (employee_id, attendance_date)
    await queryRunner.query(`
      ALTER TABLE "attendance" DROP CONSTRAINT IF EXISTS "attendance_employee_id_attendance_date_key"
    `);

    // Add new unique constraint on (employee_id, attendance_date, shift)
    await queryRunner.query(`
      ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_attendance_date_shift_key" 
      UNIQUE ("employee_id", "attendance_date", "shift")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the new unique constraint
    await queryRunner.query(`
      ALTER TABLE "attendance" DROP CONSTRAINT IF EXISTS "attendance_employee_id_attendance_date_shift_key"
    `);

    // Restore the old unique constraint
    await queryRunner.query(`
      ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_attendance_date_key" 
      UNIQUE ("employee_id", "attendance_date")
    `);
  }
}
