import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmployeesTable1731000000000 implements MigrationInterface {
  name = 'CreateEmployeesTable1731000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create employee_type enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE employee_type AS ENUM (
          'PERMANENT',
          'OCCASIONAL',
          'PICKER'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create attendance_status enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE attendance_status AS ENUM (
          'PRESENT',
          'ABSENT',
          'HALF_DAY',
          'HOLIDAY',
          'WORKED_MONDAY'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create shift_type enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE shift_type AS ENUM (
          'DAY_SHIFT',
          'NIGHT_SHIFT'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create payroll_status enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE payroll_status_enum AS ENUM (
          'DRAFT',
          'PROCESSED',
          'LOCKED',
          'PENDING',
          'APPROVED',
          'PAID'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create employees table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employees" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(100) NOT NULL,
        "designation" VARCHAR(100) NOT NULL,
        "employee_type" employee_type DEFAULT 'PERMANENT' NOT NULL,
        "monthly_salary" DECIMAL(12, 2),
        "daily_rate" DECIMAL(10, 2),
        -- Basic Details (Optional)
        "email" VARCHAR(255),
        "phone" VARCHAR(20),
        "date_of_birth" DATE,
        "address" TEXT,
        -- ID/Document Details (Optional)
        "pan_number" VARCHAR(10),
        "aadhar_number" VARCHAR(12),
        "uan_number" VARCHAR(12),
        "bank_account_number" VARCHAR(50),
        "bank_name" VARCHAR(100),
        "ifsc_code" VARCHAR(11),
        "emergency_contact_name" VARCHAR(100),
        "emergency_contact_phone" VARCHAR(20),
        -- System Fields
        "is_active" BOOLEAN DEFAULT true NOT NULL,
        "created_by" uuid REFERENCES "users"("id"),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // Create indexes for employees
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_employees_name" ON "employees"("name");`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_employees_employee_type" ON "employees"("employee_type");`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_employees_is_active" ON "employees"("is_active");`
    );

    // Create attendance table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "attendance" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "attendance_date" DATE NOT NULL,
        "status" attendance_status DEFAULT 'PRESENT' NOT NULL,
        "shift" shift_type DEFAULT 'DAY_SHIFT' NOT NULL,
        "is_holiday_worked" BOOLEAN DEFAULT false NOT NULL,
        "balance_date" DATE,
        "overtime_multiplier" DECIMAL(3, 2) DEFAULT 1.0,
        "created_by" uuid REFERENCES "users"("id"),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE("employee_id", "attendance_date")
      );
    `);

    // Create indexes for attendance
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_attendance_employee_id" ON "attendance"("employee_id");`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_attendance_date" ON "attendance"("attendance_date");`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_attendance_status" ON "attendance"("status");`
    );

    // Create employee_visits table (for occasional employees)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employee_visits" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "visit_date" DATE NOT NULL,
        "amount" DECIMAL(12, 2) NOT NULL,
        "notes" TEXT,
        "created_by" uuid REFERENCES "users"("id"),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // Create indexes for employee_visits
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_employee_visits_employee_id" ON "employee_visits"("employee_id");`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_employee_visits_date" ON "employee_visits"("visit_date");`
    );

    // Create picker_work table (for picker employees)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "picker_work" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "work_date" DATE NOT NULL,
        "rate_per_y_cups" DECIMAL(10, 2) NOT NULL,
        "y_cups" DECIMAL(10, 2) NOT NULL,
        "cup_count" DECIMAL(10, 2) NOT NULL,
        "total_amount" DECIMAL(12, 2) NOT NULL,
        "notes" TEXT,
        "created_by" uuid REFERENCES "users"("id"),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // Create indexes for picker_work
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_picker_work_employee_id" ON "picker_work"("employee_id");`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_picker_work_date" ON "picker_work"("work_date");`
    );

    // Create payroll_run table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payroll_run" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "run_for_month" DATE NOT NULL,
        "run_date" DATE NOT NULL,
        "status" payroll_status_enum DEFAULT 'DRAFT' NOT NULL,
        "is_auto_generated" BOOLEAN DEFAULT false NOT NULL,
        "generated_by" uuid REFERENCES "users"("id"),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE("run_for_month")
      );
    `);

    // Create payroll_entry table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payroll_entry" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "payroll_run_id" uuid NOT NULL REFERENCES "payroll_run"("id") ON DELETE CASCADE,
        "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
        "working_days" DECIMAL(5, 2) NOT NULL,
        "daily_rate" DECIMAL(10, 2) NOT NULL,
        "base_salary" DECIMAL(12, 2) NOT NULL,
        "overtime_amount" DECIMAL(12, 2) DEFAULT 0,
        "overtime_days" DECIMAL(5, 2) DEFAULT 0,
        "overtime_multiplier" DECIMAL(3, 2) DEFAULT 1.0,
        "half_days_deduction" DECIMAL(12, 2) DEFAULT 0,
        "half_day_count" DECIMAL(5, 2) DEFAULT 0,
        "gross_salary" DECIMAL(12, 2) NOT NULL,
        "deductions" DECIMAL(12, 2) DEFAULT 0,
        "net_salary" DECIMAL(12, 2) NOT NULL,
        "status" payroll_status_enum DEFAULT 'PENDING' NOT NULL,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE("payroll_run_id", "employee_id")
      );
    `);

    // Create indexes for payroll tables
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_payroll_run_month" ON "payroll_run"("run_for_month");`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_payroll_entry_run_id" ON "payroll_entry"("payroll_run_id");`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_payroll_entry_employee_id" ON "payroll_entry"("employee_id");`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_entry";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_run";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "picker_work";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "employee_visits";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attendance";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "employees";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payroll_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "shift_type";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "attendance_status";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "employee_type";`);
  }
}
