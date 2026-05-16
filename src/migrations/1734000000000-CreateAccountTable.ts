import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccountTable1734000000000 implements MigrationInterface {
  name = 'CreateAccountTable1734000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create account_type enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE account_type AS ENUM (
          'BANK',
          'CASH',
          'CREDIT_CARD',
          'OVERDRAFT',
          'LOAN'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create account_status enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE account_status AS ENUM (
          'ACTIVE',
          'ARCHIVED'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create account table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "account" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" VARCHAR(100) NOT NULL,
        "account_type" account_type NOT NULL,
        "status" account_status DEFAULT 'ACTIVE' NOT NULL,
        "last4" VARCHAR(4),
        "opening_balance" DECIMAL(14, 2),
        "current_balance" DECIMAL(14, 2),
        "current_outstanding" DECIMAL(14, 2),
        "credit_limit" DECIMAL(14, 2),
        "overdraft_limit" DECIMAL(14, 2),
        "principal_outstanding" DECIMAL(14, 2),
        "notes" TEXT,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_by" uuid,
        "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
        "deleted_by" uuid,
        "deleted_at" TIMESTAMP
      );
    `);

    // CHECK constraint: BANK/CASH opening_balance >= 0
    await queryRunner.query(`
      ALTER TABLE "account"
        ADD CONSTRAINT "chk_account_bank_cash_opening_balance"
        CHECK (
          CASE WHEN account_type IN ('BANK', 'CASH')
            THEN opening_balance >= 0
            ELSE true
          END
        );
    `);

    // CHECK constraint: CREDIT_CARD credit_limit > 0, current_outstanding >= 0, current_outstanding <= credit_limit
    await queryRunner.query(`
      ALTER TABLE "account"
        ADD CONSTRAINT "chk_account_credit_card"
        CHECK (
          CASE WHEN account_type = 'CREDIT_CARD'
            THEN credit_limit > 0
              AND current_outstanding >= 0
              AND current_outstanding <= credit_limit
            ELSE true
          END
        );
    `);

    // CHECK constraint: OVERDRAFT overdraft_limit > 0, current_outstanding >= 0, current_outstanding <= overdraft_limit
    await queryRunner.query(`
      ALTER TABLE "account"
        ADD CONSTRAINT "chk_account_overdraft"
        CHECK (
          CASE WHEN account_type = 'OVERDRAFT'
            THEN overdraft_limit > 0
              AND current_outstanding >= 0
              AND current_outstanding <= overdraft_limit
            ELSE true
          END
        );
    `);

    // CHECK constraint: LOAN principal_outstanding >= 0
    await queryRunner.query(`
      ALTER TABLE "account"
        ADD CONSTRAINT "chk_account_loan_principal"
        CHECK (
          CASE WHEN account_type = 'LOAN'
            THEN principal_outstanding >= 0
            ELSE true
          END
        );
    `);

    // Unique partial index on (name, account_type) WHERE status = 'ACTIVE' AND deleted_at IS NULL
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_account_name_type_active"
        ON "account" ("name", "account_type")
        WHERE status = 'ACTIVE' AND deleted_at IS NULL;
    `);

    // Additional indexes for common queries
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_account_status" ON "account"("status");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_account_type" ON "account"("account_type");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_account_type";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_account_status";`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_account_name_type_active";`,
    );

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "account";`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "account_status";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "account_type";`);
  }
}
