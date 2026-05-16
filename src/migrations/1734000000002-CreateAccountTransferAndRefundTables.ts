import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccountTransferAndRefundTables1734000000002
  implements MigrationInterface
{
  name = 'CreateAccountTransferAndRefundTables1734000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create account_transfer table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "account_transfer" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "from_account_id" uuid NOT NULL,
        "to_account_id" uuid NOT NULL,
        "amount" DECIMAL(14, 2) NOT NULL CHECK ("amount" > 0),
        "transfer_date" DATE NOT NULL,
        "description" VARCHAR(500) NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_by" uuid,
        "updated_at" TIMESTAMP DEFAULT now(),
        "deleted_by" uuid,
        "deleted_at" TIMESTAMP,
        CONSTRAINT "fk_account_transfer_from_account" FOREIGN KEY ("from_account_id") REFERENCES "account"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_account_transfer_to_account" FOREIGN KEY ("to_account_id") REFERENCES "account"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_account_transfer_different_accounts" CHECK ("from_account_id" <> "to_account_id")
      );
    `);

    // Create refund table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refund" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "expense_id" uuid NOT NULL,
        "amount" DECIMAL(14, 2) NOT NULL CHECK ("amount" > 0),
        "refund_date" DATE NOT NULL,
        "description" VARCHAR(500) NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT now(),
        "deleted_by" uuid,
        "deleted_at" TIMESTAMP,
        CONSTRAINT "fk_refund_expense" FOREIGN KEY ("expense_id") REFERENCES "expense"("id") ON DELETE RESTRICT
      );
    `);

    // Create index on refund(expense_id)
    await queryRunner.query(`
      CREATE INDEX "idx_refund_expense" ON "refund"("expense_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_refund_expense";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refund";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "account_transfer";`);
  }
}
