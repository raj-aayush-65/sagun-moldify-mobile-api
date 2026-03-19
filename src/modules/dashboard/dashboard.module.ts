import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { EmployeesModule } from '../employees/employees.module';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [EmployeesModule, AttendanceModule],
  controllers: [DashboardController],
  exports: [],
})
export class DashboardModule {}
