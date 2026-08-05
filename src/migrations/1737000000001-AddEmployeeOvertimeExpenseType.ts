import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployeeOvertimeExpenseType1737000000001 implements MigrationInterface {
  name = 'AddEmployeeOvertimeExpenseType1737000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE expense_type ADD VALUE IF NOT EXISTS 'EMPLOYEE_OVERTIME';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values without recreating the type.
    // Safe to leave as-is — unused values cause no harm.
  }
}
