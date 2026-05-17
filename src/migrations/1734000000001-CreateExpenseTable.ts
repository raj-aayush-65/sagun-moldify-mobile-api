import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExpenseTable1734000000001 implements MigrationInterface {
  name = 'CreateExpenseTable1734000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create expense_type enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE expense_type AS ENUM (
          'GENERAL',
          'EMPLOYEE_ADVANCE'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create expense_category enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE expense_category AS ENUM (
          'SALARY_ADVANCE',
          'UTILITIES',
          'RAW_MATERIAL',
          'MAINTENANCE',
          'TRAVEL',
          'MISC'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create expense table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "expense" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "amount" DECIMAL(14, 2) NOT NULL CHECK ("amount" > 0),
        "description" VARCHAR(500) NOT NULL,
        "expense_date" DATE NOT NULL,
        "expense_type" expense_type NOT NULL,
        "category" expense_category NOT NULL,
        "account_id" uuid REFERENCES "account"("id") ON DELETE SET NULL,
        "employee_id" uuid REFERENCES "employees"("id") ON DELETE SET NULL,
        "notes" TEXT,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_by" uuid,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "deleted_by" uuid,
        "deleted_at" TIMESTAMP
      );
    `);

    // Create indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_expense_date" ON "expense"("expense_date");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_expense_type_date" ON "expense"("expense_type", "expense_date");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_expense_employee_date" ON "expense"("employee_id", "expense_date");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_expense_account" ON "expense"("account_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "expense";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "expense_category";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "expense_type";`);
  }
}
