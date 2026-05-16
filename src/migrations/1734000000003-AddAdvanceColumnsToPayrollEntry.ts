import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAdvanceColumnsToPayrollEntry1734000000003 implements MigrationInterface {
  name = 'AddAdvanceColumnsToPayrollEntry1734000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add advances_deducted column (skip if exists)
    const col1 = await queryRunner.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_entry' AND column_name = 'advances_deducted'"
    );
    if (col1.length === 0) {
      await queryRunner.addColumn(
        'payroll_entry',
        new TableColumn({
          name: 'advances_deducted',
          type: 'decimal',
          precision: 12,
          scale: 2,
          isNullable: false,
          default: 0,
        })
      );
    }

    // Add carry_forward_in column (skip if exists)
    const col2 = await queryRunner.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_entry' AND column_name = 'carry_forward_in'"
    );
    if (col2.length === 0) {
      await queryRunner.addColumn(
        'payroll_entry',
        new TableColumn({
          name: 'carry_forward_in',
          type: 'decimal',
          precision: 12,
          scale: 2,
          isNullable: false,
          default: 0,
        })
      );
    }

    // Add carry_forward_out column (skip if exists)
    const col3 = await queryRunner.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_entry' AND column_name = 'carry_forward_out'"
    );
    if (col3.length === 0) {
      await queryRunner.addColumn(
        'payroll_entry',
        new TableColumn({
          name: 'carry_forward_out',
          type: 'decimal',
          precision: 12,
          scale: 2,
          isNullable: false,
          default: 0,
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('payroll_entry');

    if (table?.findColumnByName('carry_forward_out')) {
      await queryRunner.dropColumn('payroll_entry', 'carry_forward_out');
    }

    if (table?.findColumnByName('carry_forward_in')) {
      await queryRunner.dropColumn('payroll_entry', 'carry_forward_in');
    }

    if (table?.findColumnByName('advances_deducted')) {
      await queryRunner.dropColumn('payroll_entry', 'advances_deducted');
    }
  }
}
