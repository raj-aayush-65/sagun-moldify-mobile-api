import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeaveStatusToAttendance1732000000002 implements MigrationInterface {
  name = 'AddLeaveStatusToAttendance1732000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if LEAVE already exists in enum
    const checkLeave = await queryRunner.query(`
      SELECT enumlabel FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'attendance_status')
      AND enumlabel = 'LEAVE';
    `);

    if (checkLeave.length === 0) {
      // Add LEAVE to the attendance_status enum
      await queryRunner.query(`
        ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'LEAVE';
      `);
    }

    // Check if WORKED_MONDAY exists and rename to WORKING
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

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Note: Cannot easily remove enum values in PostgreSQL
    // This is a one-way migration for practical purposes
  }
}
