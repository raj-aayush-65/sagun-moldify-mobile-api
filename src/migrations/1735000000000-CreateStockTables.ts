import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStockTables1735000000000 implements MigrationInterface {
  name = 'CreateStockTables1735000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── ENUMS ───────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE shift_enum AS ENUM ('DAY', 'NIGHT');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE roll_status_enum AS ENUM ('AVAILABLE', 'IN_USE', 'CONSUMED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE wastage_category_enum AS ENUM (
          'CUT_PIECE',
          'POWER_CUT_CHANGE_OVER',
          'UNGRINDABLE_SCREEN_CHANGE',
          'MISHANDLING'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE printer_machine_enum AS ENUM ('PRINTER_1', 'PRINTER_2');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // ─── TABLES ──────────────────────────────────────────────────────────────────

    // 1. raw_material_type
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "raw_material_type" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(100) NOT NULL,
        "is_active" BOOLEAN DEFAULT true NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_by" uuid,
        "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // 2. raw_material_purchase
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "raw_material_purchase" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "material_type_id" uuid NOT NULL REFERENCES "raw_material_type"("id"),
        "vendor_name" VARCHAR(200) NOT NULL,
        "quantity" DECIMAL(10, 3) NOT NULL,
        "price_per_kg" DECIMAL(14, 2) NOT NULL,
        "total_price" DECIMAL(14, 2) NOT NULL,
        "purchase_date" DATE NOT NULL,
        "notes" TEXT,
        "deleted_at" TIMESTAMP,
        "deleted_by" uuid,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_by" uuid,
        "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // 3. product
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(200) NOT NULL,
        "size" VARCHAR(50) NOT NULL,
        "volume" VARCHAR(50) NOT NULL,
        "colour" VARCHAR(50) NOT NULL,
        "weight_per_cup" DECIMAL(5, 2) NOT NULL,
        "quantity_per_box" INTEGER NOT NULL,
        "selling_price_per_box" DECIMAL(14, 2),
        "is_active" BOOLEAN DEFAULT true NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_by" uuid,
        "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // 4. party
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "party" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(200) NOT NULL,
        "contact_info" VARCHAR(500),
        "gst_number" VARCHAR(15),
        "address" VARCHAR(500),
        "phone" VARCHAR(15),
        "is_active" BOOLEAN DEFAULT true NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_by" uuid,
        "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // 5. sheet_line_report
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sheet_line_report" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "date" DATE NOT NULL,
        "shift" shift_enum NOT NULL,
        "remarks" VARCHAR(500),
        "reconciliation_warning" BOOLEAN DEFAULT false,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_by" uuid,
        "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // 6. sheet_line_material_usage
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sheet_line_material_usage" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sheet_line_report_id" uuid NOT NULL REFERENCES "sheet_line_report"("id") ON DELETE CASCADE,
        "material_type_id" uuid NOT NULL REFERENCES "raw_material_type"("id"),
        "quantity_used" DECIMAL(10, 2) NOT NULL
      );
    `);

    // 7. sheet_line_mix_ratio
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sheet_line_mix_ratio" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sheet_line_report_id" uuid NOT NULL REFERENCES "sheet_line_report"("id") ON DELETE CASCADE,
        "material_type_id" uuid NOT NULL REFERENCES "raw_material_type"("id"),
        "proportion" DECIMAL(5, 2) NOT NULL
      );
    `);

    // 8. sheet_line_wastage
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sheet_line_wastage" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sheet_line_report_id" uuid NOT NULL REFERENCES "sheet_line_report"("id") ON DELETE CASCADE,
        "wastage_category" wastage_category_enum NOT NULL,
        "weight" DECIMAL(10, 2) NOT NULL
      );
    `);

    // 9. roll
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "roll" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "roll_no" VARCHAR(50) NOT NULL,
        "date" DATE NOT NULL,
        "sheet_line_report_id" uuid NOT NULL REFERENCES "sheet_line_report"("id"),
        "thickness" DECIMAL(4, 1) NOT NULL,
        "width" DECIMAL(6, 1) NOT NULL,
        "colour" VARCHAR(30) NOT NULL,
        "gross_weight" DECIMAL(10, 3) NOT NULL,
        "core_weight" DECIMAL(10, 3) NOT NULL,
        "net_weight" DECIMAL(10, 3) NOT NULL,
        "status" roll_status_enum DEFAULT 'AVAILABLE' NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_by" uuid,
        "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // 10. tfm_production_record
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tfm_production_record" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "date" DATE NOT NULL,
        "shift" shift_enum NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_by" uuid,
        "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // 11. tfm_roll_consumption
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tfm_roll_consumption" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tfm_production_record_id" uuid NOT NULL REFERENCES "tfm_production_record"("id") ON DELETE CASCADE,
        "roll_id" uuid NOT NULL REFERENCES "roll"("id"),
        "roll_weight" DECIMAL(10, 3) NOT NULL,
        "wastage" DECIMAL(10, 3) NOT NULL,
        "shift_end_status" roll_status_enum NOT NULL,
        "remaining_weight" DECIMAL(10, 3),
        "weight_mismatch" BOOLEAN DEFAULT false,
        "remarks" VARCHAR(500)
      );
    `);

    // 12. tfm_production_output
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tfm_production_output" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tfm_production_record_id" uuid NOT NULL REFERENCES "tfm_production_record"("id") ON DELETE CASCADE,
        "product_id" uuid NOT NULL REFERENCES "product"("id"),
        "quantity" INTEGER NOT NULL,
        "loose_count" INTEGER DEFAULT 0 NOT NULL,
        "total_boxes" INTEGER NOT NULL,
        "loose_cups" INTEGER NOT NULL
      );
    `);

    // 13. printing_record
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "printing_record" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "date" DATE NOT NULL,
        "shift" shift_enum NOT NULL,
        "printer_machine" printer_machine_enum NOT NULL,
        "party_id" uuid NOT NULL REFERENCES "party"("id"),
        "product_id" uuid NOT NULL REFERENCES "product"("id"),
        "quantity" INTEGER NOT NULL,
        "deleted_at" TIMESTAMP,
        "deleted_by" uuid,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_by" uuid,
        "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // 14. packing_record
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "packing_record" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "date" DATE NOT NULL,
        "shift" shift_enum NOT NULL,
        "party_id" uuid NOT NULL REFERENCES "party"("id"),
        "product_id" uuid NOT NULL REFERENCES "product"("id"),
        "box_count" INTEGER NOT NULL,
        "loose_cups" INTEGER DEFAULT 0 NOT NULL,
        "total_cups" INTEGER NOT NULL,
        "invoice_id" uuid,
        "deleted_at" TIMESTAMP,
        "deleted_by" uuid,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_by" uuid,
        "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // 15. invoice (placeholder)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoice" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoice_number" VARCHAR(50),
        "party_id" uuid NOT NULL REFERENCES "party"("id"),
        "account_id" uuid REFERENCES "account"("id"),
        "invoice_date" DATE,
        "total_amount" DECIMAL(14, 2),
        "status" VARCHAR(20),
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_by" uuid,
        "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // Add FK from packing_record to invoice (after invoice table exists)
    await queryRunner.query(`
      ALTER TABLE "packing_record"
        ADD CONSTRAINT "fk_packing_record_invoice"
        FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE SET NULL;
    `);

    // ─── UNIQUE CONSTRAINTS ──────────────────────────────────────────────────────

    // raw_material_type.name (case-insensitive)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_raw_material_type_name_lower"
        ON "raw_material_type" (LOWER("name"));
    `);

    // product(name, size, colour)
    await queryRunner.query(`
      ALTER TABLE "product"
        ADD CONSTRAINT "uq_product_name_size_colour"
        UNIQUE ("name", "size", "colour");
    `);

    // party.name (case-insensitive)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_party_name_lower"
        ON "party" (LOWER("name"));
    `);

    // sheet_line_report(date, shift)
    await queryRunner.query(`
      ALTER TABLE "sheet_line_report"
        ADD CONSTRAINT "uq_sheet_line_report_date_shift"
        UNIQUE ("date", "shift");
    `);

    // roll.roll_no
    await queryRunner.query(`
      ALTER TABLE "roll"
        ADD CONSTRAINT "uq_roll_roll_no"
        UNIQUE ("roll_no");
    `);

    // tfm_production_record(date, shift)
    await queryRunner.query(`
      ALTER TABLE "tfm_production_record"
        ADD CONSTRAINT "uq_tfm_production_record_date_shift"
        UNIQUE ("date", "shift");
    `);

    // ─── INDEXES ─────────────────────────────────────────────────────────────────

    // Foreign key indexes
    await queryRunner.query(
      `CREATE INDEX "idx_raw_material_purchase_material_type_id" ON "raw_material_purchase"("material_type_id");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sheet_line_material_usage_report_id" ON "sheet_line_material_usage"("sheet_line_report_id");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sheet_line_material_usage_material_type_id" ON "sheet_line_material_usage"("material_type_id");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sheet_line_mix_ratio_report_id" ON "sheet_line_mix_ratio"("sheet_line_report_id");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sheet_line_mix_ratio_material_type_id" ON "sheet_line_mix_ratio"("material_type_id");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sheet_line_wastage_report_id" ON "sheet_line_wastage"("sheet_line_report_id");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_roll_sheet_line_report_id" ON "roll"("sheet_line_report_id");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tfm_roll_consumption_record_id" ON "tfm_roll_consumption"("tfm_production_record_id");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tfm_roll_consumption_roll_id" ON "tfm_roll_consumption"("roll_id");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tfm_production_output_record_id" ON "tfm_production_output"("tfm_production_record_id");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tfm_production_output_product_id" ON "tfm_production_output"("product_id");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_printing_record_party_id" ON "printing_record"("party_id");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_printing_record_product_id" ON "printing_record"("product_id");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_packing_record_party_id" ON "packing_record"("party_id");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_packing_record_product_id" ON "packing_record"("product_id");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_packing_record_invoice_id" ON "packing_record"("invoice_id");`
    );
    await queryRunner.query(`CREATE INDEX "idx_invoice_party_id" ON "invoice"("party_id");`);
    await queryRunner.query(`CREATE INDEX "idx_invoice_account_id" ON "invoice"("account_id");`);

    // Common filter column indexes
    await queryRunner.query(
      `CREATE INDEX "idx_raw_material_purchase_purchase_date" ON "raw_material_purchase"("purchase_date");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sheet_line_report_date" ON "sheet_line_report"("date");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sheet_line_report_shift" ON "sheet_line_report"("shift");`
    );
    await queryRunner.query(`CREATE INDEX "idx_roll_date" ON "roll"("date");`);
    await queryRunner.query(`CREATE INDEX "idx_roll_status" ON "roll"("status");`);
    await queryRunner.query(
      `CREATE INDEX "idx_tfm_production_record_date" ON "tfm_production_record"("date");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tfm_production_record_shift" ON "tfm_production_record"("shift");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_printing_record_date" ON "printing_record"("date");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_printing_record_shift" ON "printing_record"("shift");`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_printing_record_printer_machine" ON "printing_record"("printer_machine");`
    );
    await queryRunner.query(`CREATE INDEX "idx_packing_record_date" ON "packing_record"("date");`);
    await queryRunner.query(
      `CREATE INDEX "idx_packing_record_shift" ON "packing_record"("shift");`
    );

    // ─── SEED DATA ───────────────────────────────────────────────────────────────

    await queryRunner.query(`
      INSERT INTO "raw_material_type" ("name", "is_active", "created_by")
      VALUES
        ('HIPS', true, '00000000-0000-0000-0000-000000000000'),
        ('PP', true, '00000000-0000-0000-0000-000000000000'),
        ('MASTER_BATCH', true, '00000000-0000-0000-0000-000000000000'),
        ('GGPS', true, '00000000-0000-0000-0000-000000000000'),
        ('RECYCLE_FLACKS', true, '00000000-0000-0000-0000-000000000000')
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop FK constraint from packing_record to invoice
    await queryRunner.query(
      `ALTER TABLE "packing_record" DROP CONSTRAINT IF EXISTS "fk_packing_record_invoice";`
    );

    // Drop indexes (filter columns)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_packing_record_shift";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_packing_record_date";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_printing_record_printer_machine";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_printing_record_shift";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_printing_record_date";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tfm_production_record_shift";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tfm_production_record_date";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_roll_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_roll_date";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sheet_line_report_shift";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sheet_line_report_date";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_raw_material_purchase_purchase_date";`);

    // Drop indexes (foreign keys)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_invoice_account_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_invoice_party_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_packing_record_invoice_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_packing_record_product_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_packing_record_party_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_printing_record_product_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_printing_record_party_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tfm_production_output_product_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tfm_production_output_record_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tfm_roll_consumption_roll_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tfm_roll_consumption_record_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_roll_sheet_line_report_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sheet_line_wastage_report_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sheet_line_mix_ratio_material_type_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sheet_line_mix_ratio_report_id";`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_sheet_line_material_usage_material_type_id";`
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sheet_line_material_usage_report_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_raw_material_purchase_material_type_id";`);

    // Drop unique constraints/indexes
    await queryRunner.query(
      `ALTER TABLE "tfm_production_record" DROP CONSTRAINT IF EXISTS "uq_tfm_production_record_date_shift";`
    );
    await queryRunner.query(`ALTER TABLE "roll" DROP CONSTRAINT IF EXISTS "uq_roll_roll_no";`);
    await queryRunner.query(
      `ALTER TABLE "sheet_line_report" DROP CONSTRAINT IF EXISTS "uq_sheet_line_report_date_shift";`
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_party_name_lower";`);
    await queryRunner.query(
      `ALTER TABLE "product" DROP CONSTRAINT IF EXISTS "uq_product_name_size_colour";`
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_raw_material_type_name_lower";`);

    // Drop tables (reverse order of creation, respecting FK dependencies)
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "packing_record";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "printing_record";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tfm_production_output";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tfm_roll_consumption";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tfm_production_record";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roll";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sheet_line_wastage";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sheet_line_mix_ratio";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sheet_line_material_usage";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sheet_line_report";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "party";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "raw_material_purchase";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "raw_material_type";`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "printer_machine_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "wastage_category_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "roll_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "shift_enum";`);
  }
}
