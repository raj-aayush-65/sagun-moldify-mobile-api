import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1700000000000 implements MigrationInterface {
  name = "InitialSchema1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create user_role enum type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM (
          'SUPER_ADMIN',
          'SUPER_USER',
          'HIGHER_OPS',
          'EMPLOYEE'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create permission_type enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE permission_type AS ENUM (
          'CREATE',
          'READ',
          'UPDATE',
          'DELETE',
          'EXPORT',
          'ADMIN'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" VARCHAR(255) UNIQUE NOT NULL,
        "password_hash" VARCHAR(255) NOT NULL,
        "first_name" VARCHAR(100) NOT NULL,
        "last_name" VARCHAR(100),
        "phone" VARCHAR(20),
        "role" user_role DEFAULT 'EMPLOYEE' NOT NULL,
        "is_active" BOOLEAN DEFAULT true NOT NULL,
        "is_super_admin" BOOLEAN DEFAULT false NOT NULL,
        "created_by" uuid REFERENCES "users"("id"),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // Create indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users"("email");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users"("role");`,
    );

    // Create role_permissions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "role" user_role NOT NULL,
        "module" VARCHAR(100) NOT NULL,
        "permission_type" permission_type NOT NULL,
        "is_allowed" BOOLEAN DEFAULT true NOT NULL,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE("role", "module", "permission_type")
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_role_permissions_role" ON "role_permissions"("role");`,
    );

    // Insert SUPER_ADMIN permissions
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role", "module", "permission_type", "is_allowed") VALUES
      ('SUPER_ADMIN', 'USERS', 'CREATE', true),
      ('SUPER_ADMIN', 'USERS', 'READ', true),
      ('SUPER_ADMIN', 'USERS', 'UPDATE', true),
      ('SUPER_ADMIN', 'USERS', 'DELETE', true),
      ('SUPER_ADMIN', 'USERS', 'ADMIN', true),
      ('SUPER_ADMIN', 'DASHBOARD', 'READ', true),
      ('SUPER_ADMIN', 'REPORTS', 'CREATE', true),
      ('SUPER_ADMIN', 'REPORTS', 'READ', true),
      ('SUPER_ADMIN', 'REPORTS', 'UPDATE', true),
      ('SUPER_ADMIN', 'REPORTS', 'DELETE', true),
      ('SUPER_ADMIN', 'REPORTS', 'EXPORT', true),
      ('SUPER_ADMIN', 'SETTINGS', 'CREATE', true),
      ('SUPER_ADMIN', 'SETTINGS', 'READ', true),
      ('SUPER_ADMIN', 'SETTINGS', 'UPDATE', true),
      ('SUPER_ADMIN', 'SETTINGS', 'DELETE', true),
      ('SUPER_ADMIN', 'FINANCE', 'CREATE', true),
      ('SUPER_ADMIN', 'FINANCE', 'READ', true),
      ('SUPER_ADMIN', 'FINANCE', 'UPDATE', true),
      ('SUPER_ADMIN', 'FINANCE', 'DELETE', true),
      ('SUPER_ADMIN', 'FINANCE', 'EXPORT', true),
      ('SUPER_ADMIN', 'FINANCE', 'ADMIN', true)
      ON CONFLICT DO NOTHING;
    `);

    // Insert SUPER_USER permissions
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role", "module", "permission_type", "is_allowed") VALUES
      ('SUPER_USER', 'USERS', 'CREATE', true),
      ('SUPER_USER', 'USERS', 'READ', true),
      ('SUPER_USER', 'USERS', 'UPDATE', true),
      ('SUPER_USER', 'USERS', 'DELETE', true),
      ('SUPER_USER', 'USERS', 'ADMIN', false),
      ('SUPER_USER', 'DASHBOARD', 'READ', true),
      ('SUPER_USER', 'REPORTS', 'CREATE', true),
      ('SUPER_USER', 'REPORTS', 'READ', true),
      ('SUPER_USER', 'REPORTS', 'UPDATE', true),
      ('SUPER_USER', 'REPORTS', 'DELETE', true),
      ('SUPER_USER', 'REPORTS', 'EXPORT', true),
      ('SUPER_USER', 'SETTINGS', 'CREATE', true),
      ('SUPER_USER', 'SETTINGS', 'READ', true),
      ('SUPER_USER', 'SETTINGS', 'UPDATE', true),
      ('SUPER_USER', 'SETTINGS', 'DELETE', true),
      ('SUPER_USER', 'FINANCE', 'CREATE', true),
      ('SUPER_USER', 'FINANCE', 'READ', true),
      ('SUPER_USER', 'FINANCE', 'UPDATE', true),
      ('SUPER_USER', 'FINANCE', 'DELETE', true),
      ('SUPER_USER', 'FINANCE', 'EXPORT', true),
      ('SUPER_USER', 'FINANCE', 'ADMIN', false)
      ON CONFLICT DO NOTHING;
    `);

    // Insert HIGHER_OPS permissions
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role", "module", "permission_type", "is_allowed") VALUES
      ('HIGHER_OPS', 'USERS', 'CREATE', false),
      ('HIGHER_OPS', 'USERS', 'READ', true),
      ('HIGHER_OPS', 'USERS', 'UPDATE', false),
      ('HIGHER_OPS', 'USERS', 'DELETE', false),
      ('HIGHER_OPS', 'DASHBOARD', 'READ', true),
      ('HIGHER_OPS', 'REPORTS', 'CREATE', true),
      ('HIGHER_OPS', 'REPORTS', 'READ', true),
      ('HIGHER_OPS', 'REPORTS', 'UPDATE', true),
      ('HIGHER_OPS', 'REPORTS', 'DELETE', false),
      ('HIGHER_OPS', 'REPORTS', 'EXPORT', true),
      ('HIGHER_OPS', 'SETTINGS', 'READ', true),
      ('HIGHER_OPS', 'FINANCE', 'READ', true),
      ('HIGHER_OPS', 'FINANCE', 'EXPORT', true)
      ON CONFLICT DO NOTHING;
    `);

    // Insert EMPLOYEE permissions (restricted)
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role", "module", "permission_type", "is_allowed") VALUES
      ('EMPLOYEE', 'USERS', 'CREATE', false),
      ('EMPLOYEE', 'USERS', 'READ', false),
      ('EMPLOYEE', 'USERS', 'UPDATE', false),
      ('EMPLOYEE', 'USERS', 'DELETE', false),
      ('EMPLOYEE', 'USERS', 'ADMIN', false),
      ('EMPLOYEE', 'DASHBOARD', 'READ', true),
      ('EMPLOYEE', 'REPORTS', 'CREATE', false),
      ('EMPLOYEE', 'REPORTS', 'READ', true),
      ('EMPLOYEE', 'REPORTS', 'UPDATE', false),
      ('EMPLOYEE', 'REPORTS', 'DELETE', false),
      ('EMPLOYEE', 'REPORTS', 'EXPORT', false),
      ('EMPLOYEE', 'SETTINGS', 'CREATE', false),
      ('EMPLOYEE', 'SETTINGS', 'READ', false),
      ('EMPLOYEE', 'SETTINGS', 'UPDATE', false),
      ('EMPLOYEE', 'SETTINGS', 'DELETE', false),
      ('EMPLOYEE', 'FINANCE', 'CREATE', false),
      ('EMPLOYEE', 'FINANCE', 'READ', false),
      ('EMPLOYEE', 'FINANCE', 'UPDATE', false),
      ('EMPLOYEE', 'FINANCE', 'DELETE', false),
      ('EMPLOYEE', 'FINANCE', 'EXPORT', false),
      ('EMPLOYEE', 'FINANCE', 'ADMIN', false)
      ON CONFLICT DO NOTHING;
    `);

    // Create refresh_tokens table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token" VARCHAR(500) NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_user_id" ON "refresh_tokens"("user_id");`,
    );

    // Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid REFERENCES "users"("id"),
        "action" VARCHAR(100) NOT NULL,
        "entity_type" VARCHAR(50),
        "entity_id" VARCHAR(100),
        "details" JSONB,
        "ip_address" VARCHAR(50),
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_id" ON "audit_logs"("user_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "audit_logs"("created_at");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "permission_type";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role";`);
  }
}
