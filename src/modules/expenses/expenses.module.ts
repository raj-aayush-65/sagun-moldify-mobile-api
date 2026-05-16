import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Expense } from './entities/expense.entity';
import { Refund } from './entities/refund.entity';
import { Account } from '../accounts/entities/account.entity';
import { AccountTransfer } from '../accounts/entities/account-transfer.entity';
import { Employee } from '../employees/entities/employee.entity';
import { PayrollRun } from '../payroll/entities/payroll-run.entity';
import { PayrollEntry } from '../payroll/entities/payroll-entry.entity';
import { ExpensesService } from './expenses.service';
import { AccountBalanceService } from './account-balance.service';
import { PayrollIntegrationService } from './payroll-integration.service';
import { ExpensesController } from './expenses.controller';
import { EmployeeAdvancesController } from './employee-advances.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense, Refund, Account, AccountTransfer, Employee, PayrollRun, PayrollEntry]),
    ConfigModule,
  ],
  controllers: [ExpensesController, EmployeeAdvancesController],
  providers: [ExpensesService, AccountBalanceService, PayrollIntegrationService],
  exports: [ExpensesService, AccountBalanceService, PayrollIntegrationService],
})
export class ExpensesModule {}
