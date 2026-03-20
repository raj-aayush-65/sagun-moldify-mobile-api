import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddAttendanceRateFields1732000000000 implements MigrationInterface {
  name = 'AddAttendanceRateFields1732000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add per_visit_rate column for OCCASIONAL employees
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

    // Add per_cup_rate column for PICKER employees (legacy)
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

    // Add cups_count column for PICKER employees
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

    // Add cups_unit column for PICKER employees
    await queryRunner.addColumn(
      'attendance',
      new TableColumn({
        name: 'cups_unit',
        type: 'enum',
        enum: ['PER_100', 'PER_THOUSAND', 'PER_10_THOUSAND'],
        isNullable: true,
      })
    );

    // Add cups_rate column for PICKER employees
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

    // Add cups_rate_unit column for PICKER employees
    await queryRunner.addColumn(
      'attendance',
      new TableColumn({
        name: 'cups_rate_unit',
        type: 'enum',
        enum: ['PER_100', 'PER_THOUSAND', 'PER_10_THOUSAND'],
        isNullable: true,
      })
    );
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
