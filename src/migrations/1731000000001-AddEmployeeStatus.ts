import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEmployeeStatus1731000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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

    // Update existing employees to have ACTIVE status
    await queryRunner.query(`UPDATE employees SET status = 'ACTIVE' WHERE status IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('employees', 'status');
  }
}
