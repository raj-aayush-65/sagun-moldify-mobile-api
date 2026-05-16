import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { AccountTransfer } from './entities/account-transfer.entity';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { AccountTransfersController } from './account-transfers.controller';
import { ExpensesModule } from '../expenses/expenses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Account, AccountTransfer]),
    ExpensesModule,
  ],
  controllers: [AccountsController, AccountTransfersController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
