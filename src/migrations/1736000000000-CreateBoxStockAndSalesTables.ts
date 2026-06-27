import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBoxStockAndSalesTables1736000000000 implements MigrationInterface {
  name = 'CreateBoxStockAndSalesTables1736000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── ENUMS ───────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE payment_status_enum AS ENUM ('PENDING', 'PARTIAL', 'PAID');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // ─── TABLES ──────────────────────────────────────────────────────────────────

    // 1. box_variant — lookup table for box types (e.g. "35mL Cup - 12000 pcs/box")
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "box_variant" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(200) NOT NULL,
        "pieces_per_box" INTEGER NOT NULL,
        "is_active" BOOLEAN DEFAULT true NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_by" uuid,
        "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // 2. company — companies to whom we sell
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(200) NOT NULL,
        "phone" VARCHAR(20),
        "address" TEXT,
        "gst_number" VARCHAR(20),
        "contact_person" VARCHAR(200),
        "is_active" BOOLEAN DEFAULT true NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_by" uuid,
        "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // 3. stock_entry — records of boxes added to inventory
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_entry" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "box_variant_id" uuid NOT NULL REFERENCES "box_variant"("id"),
        "quantity" INTEGER NOT NULL,
        "entry_date" DATE NOT NULL,
        "notes" TEXT,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // 4. sale — a sale transaction to a company
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sale" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL REFERENCES "company"("id"),
        "sale_date" DATE NOT NULL,
        "buyer_name" VARCHAR(200),
        "delivery_address" TEXT,
        "payment_status" payment_status_enum DEFAULT 'PENDING' NOT NULL,
        "total_amount" DECIMAL(14, 2),
        "notes" TEXT,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_by" uuid,
        "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // 5. sale_item — line items in a sale
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sale_item" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sale_id" uuid NOT NULL REFERENCES "sale"("id") ON DELETE CASCADE,
        "box_variant_id" uuid NOT NULL REFERENCES "box_variant"("id"),
        "quantity" INTEGER NOT NULL,
        "price_per_box" DECIMAL(14, 2),
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // ─── UNIQUE CONSTRAINTS ──────────────────────────────────────────────────────

    // box_variant.name (case-insensitive unique)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_box_variant_name_lower"
        ON "box_variant" (LOWER("name"));
    `);

    // company.name (case-insensitive unique)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_company_name_lower"
        ON "company" (LOWER("name"));
    `);

    // ─── INDEXES ─────────────────────────────────────────────────────────────────

    await queryRunner.query(
      `CREATE INDEX "idx_stock_entry_box_variant_id" ON "stock_entry"("box_variant_id");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_stock_entry_entry_date" ON "stock_entry"("entry_date");`
    );
    await queryRunner.query(`CREATE INDEX "idx_sale_company_id" ON "sale"("company_id");`);
    await queryRunner.query(`CREATE INDEX "idx_sale_sale_date" ON "sale"("sale_date");`);
    await queryRunner.query(`CREATE INDEX "idx_sale_payment_status" ON "sale"("payment_status");`);
    await queryRunner.query(`CREATE INDEX "idx_sale_item_sale_id" ON "sale_item"("sale_id");`);
    await queryRunner.query(
      `CREATE INDEX "idx_sale_item_box_variant_id" ON "sale_item"("box_variant_id");`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_item_box_variant_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_item_sale_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_payment_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_sale_date";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_company_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_stock_entry_entry_date";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_stock_entry_box_variant_id";`);

    // Drop unique indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_company_name_lower";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_box_variant_name_lower";`);

    // Drop tables (reverse order)
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_item";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sale";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_entry";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "company";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "box_variant";`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_status_enum";`);
  }
}
