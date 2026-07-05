import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanyIdToStockEntry1737000000000 implements MigrationInterface {
  name = 'AddCompanyIdToStockEntry1737000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add nullable company_id column to stock_entry
    await queryRunner.query(`
      ALTER TABLE "stock_entry"
        ADD COLUMN "company_id" uuid REFERENCES "company"("id");
    `);

    // Add index for faster lookups by company
    await queryRunner.query(
      `CREATE INDEX "idx_stock_entry_company_id" ON "stock_entry"("company_id");`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_stock_entry_company_id";`);
    await queryRunner.query(`ALTER TABLE "stock_entry" DROP COLUMN IF EXISTS "company_id";`);
  }
}
