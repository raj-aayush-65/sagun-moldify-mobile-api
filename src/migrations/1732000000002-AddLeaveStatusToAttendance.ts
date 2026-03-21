import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeaveStatusToAttendance1732000000002 implements MigrationInterface {
  name = 'AddLeaveStatusToAttendance1732000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add LEAVE to the attendance_status enum
    await queryRunner.query(`
      ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'LEAVE';
    `);

    // Rename WORKED_MONDAY to WORKING if it exists (for consistency)
    // First check if WORKED_MONDAY exists
    const checkWorkedMonday = await queryRunner.query(`
      SELECT enumlabel FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'attendance_status')
      AND enumlabel = 'WORKED_MONDAY';
    `);

    if (checkWorkedMonday.length > 0) {
      // Rename WORKED_MONDAY to WORKING
      await queryRunner.query(`
        ALTER TYPE attendance_status RENAME VALUE 'WORKED_MONDAY' TO 'WORKING';
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove LEAVE from enum
    await queryRunner.query(`
      ALTER TYPE attendance_status DROP VALUE IF EXISTS 'LEAVE';
    `);

    // Rename WORKING back to WORKED_MONDAY
    await queryRunner.query(`
      ALTER TYPE attendance_status RENAME VALUE 'WORKING' TO 'WORKED_MONDAY';
    `);
  }
}
