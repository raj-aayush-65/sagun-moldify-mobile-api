import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAttendanceRateFields1732000000000 implements MigrationInterface {
  name = 'AddAttendanceRateFields1732000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add per_visit_rate column for OCCASIONAL employees (skip if exists)
    const col1 = await queryRunner.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'per_visit_rate'"
    );
    if (col1.length === 0) {
      await queryRunner.addColumn(
        'attendance',
        new TableColumn({
          name: 'per_visit_rate',
          type: 'decimal',
          precision: 10,
          scale: 2,
          isNullable: true,
        })
      );
    }

    // Add per_cup_rate column for PICKER employees (legacy) (skip if exists)
    const col2 = await queryRunner.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'per_cup_rate'"
    );
    if (col2.length === 0) {
      await queryRunner.addColumn(
        'attendance',
        new TableColumn({
          name: 'per_cup_rate',
          type: 'decimal',
          precision: 10,
          scale: 2,
          isNullable: true,
        })
      );
    }

    // Add cups_count column for PICKER employees (skip if exists)
    const col3 = await queryRunner.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'cups_count'"
    );
    if (col3.length === 0) {
      await queryRunner.addColumn(
        'attendance',
        new TableColumn({
          name: 'cups_count',
          type: 'decimal',
          precision: 12,
          scale: 2,
          isNullable: true,
        })
      );
    }

    // Add cups_unit column for PICKER employees (skip if exists)
    const col4 = await queryRunner.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'cups_unit'"
    );
    if (col4.length === 0) {
      await queryRunner.addColumn(
        'attendance',
        new TableColumn({
          name: 'cups_unit',
          type: 'varchar',
          length: '20',
          isNullable: true,
        })
      );
    }

    // Add cups_rate column for PICKER employees (skip if exists)
    const col5 = await queryRunner.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'cups_rate'"
    );
    if (col5.length === 0) {
      await queryRunner.addColumn(
        'attendance',
        new TableColumn({
          name: 'cups_rate',
          type: 'decimal',
          precision: 10,
          scale: 2,
          isNullable: true,
        })
      );
    }

    // Add cups_rate_unit column for PICKER employees (skip if exists)
    const col6 = await queryRunner.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'cups_rate_unit'"
    );
    if (col6.length === 0) {
      await queryRunner.addColumn(
        'attendance',
        new TableColumn({
          name: 'cups_rate_unit',
          type: 'varchar',
          length: '20',
          isNullable: true,
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('attendance', 'cups_rate_unit');
    await queryRunner.dropColumn('attendance', 'cups_rate');
    await queryRunner.dropColumn('attendance', 'cups_unit');
    await queryRunner.dropColumn('attendance', 'cups_count');
    await queryRunner.dropColumn('attendance', 'per_cup_rate');
    await queryRunner.dropColumn('attendance', 'per_visit_rate');
  }
}
