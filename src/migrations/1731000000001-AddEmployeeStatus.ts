import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEmployeeStatus1731000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if status column already exists
    const table = await queryRunner.getTable('employees');
    const statusColumn = table?.findColumnByName('status');

    if (!statusColumn) {
      // Add status column to employees table
      await queryRunner.addColumn(
        'employees',
        new TableColumn({
          name: 'status',
          type: 'varchar',
          length: '20',
          default: "'ACTIVE'",
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if column exists before dropping
    const table = await queryRunner.getTable('employees');
    const statusColumn = table?.findColumnByName('status');

    if (statusColumn) {
      await queryRunner.dropColumn('employees', 'status');
    }
  }
}
