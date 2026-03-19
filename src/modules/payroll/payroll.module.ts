import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayrollRun } from './entities/payroll-run.entity';
import { PayrollEntry } from './entities/payroll-entry.entity';
import { PayrollService } from './payroll.service';
import { PdfService } from './pdf.service';
import { PayrollController } from './payroll.controller';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EmployeesModule } from '../employees/employees.module';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayrollRun, PayrollEntry]),
    EmployeesModule,
    AttendanceModule,
  ],
  controllers: [PayrollController],
  providers: [PayrollService, PdfService, RolesGuard],
  exports: [PayrollService, PdfService],
})
export class PayrollModule {}
