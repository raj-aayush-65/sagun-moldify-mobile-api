import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { PayrollService } from './payroll.service';
import { PdfService } from './pdf.service';
import { PayrollEntryStatus } from './entities/payroll-entry.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

import { AttendanceStatus } from '../attendance/entities/attendance.entity';

// Helper functions for preview
const SALARY_DAYS = 30;

function getMondaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let mondays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month - 1, d).getDay() === 1) mondays++;
  }
  return mondays;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

interface AuthRequest {
  user: {
    id: string;
    role: UserRole;
  };
}

@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly pdfService: PdfService
  ) {}

  @Post('run')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  runPayroll(
    @Body() body: { year: number; month: number; overtimeMultiplier?: number; overwrite?: boolean },
    @Request() req: AuthRequest
  ) {
    return this.payrollService.runPayroll(
      body.year,
      body.month,
      req.user.id,
      false,
      body.overtimeMultiplier,
      body.overwrite || false
    );
  }

  @Get('month/:year/:month')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  getPayrollByMonth(@Param('year') year: string, @Param('month') month: string) {
    return this.payrollService.getPayrollByMonth(parseInt(year), parseInt(month));
  }

  @Get('summary/:year/:month')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  getPayrollSummary(@Param('year') year: string, @Param('month') month: string) {
    return this.payrollService.getPayrollSummary(parseInt(year), parseInt(month));
  }

  @Get('preview/:year/:month')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  async getPayrollPreview(
    @Param('year') year: string,
    @Param('month') month: string,
    @Query('overtimeMultiplier') overtimeMultiplier?: string
  ) {
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const multiplier = overtimeMultiplier ? parseFloat(overtimeMultiplier) : 1.5;

    // Get all active employees
    const employees = await this.payrollService.getActiveEmployeesForPreview();

    // Get monthly attendance for all employees
    const allAttendance = await this.payrollService.getMonthlyAttendanceForPreview(
      yearNum,
      monthNum
    );

    const totalDaysInMonth = getDaysInMonth(yearNum, monthNum);
    const mondaysInMonth = getMondaysInMonth(yearNum, monthNum);
    const requiredWorkingDays = totalDaysInMonth - mondaysInMonth;

    const previews = employees.map(employee => {
      const attendance = allAttendance.filter((a: any) => a.employeeId === employee.id);

      const monthlySalary = Number(employee.monthlySalary) || 0;
      const dailyRate = monthlySalary / SALARY_DAYS;

      const presentDays = attendance.filter(
        (a: any) => a.status === AttendanceStatus.PRESENT
      ).length;
      const halfDays = attendance.filter((a: any) => a.status === AttendanceStatus.HALF_DAY).length;
      const workedMonday = attendance.filter(
        (a: any) => a.status === AttendanceStatus.WORKING
      ).length;

      const effectiveWorkingDays = presentDays + workedMonday + halfDays * 0.5;
      const overtimeDays = Math.max(0, effectiveWorkingDays - requiredWorkingDays);
      const overtimeAmount = overtimeDays * dailyRate * multiplier;
      const halfDayDeduction = halfDays * (dailyRate * 0.5);
      const baseSalary = Math.min(effectiveWorkingDays, requiredWorkingDays) * dailyRate;
      const netSalary = baseSalary + overtimeAmount - halfDayDeduction;

      return {
        employeeId: employee.id,
        employeeName: employee.name,
        employeeType: employee.employeeType,
        designation: employee.designation,
        monthlySalary,
        workingDays: effectiveWorkingDays,
        requiredDays: requiredWorkingDays,
        totalDays: totalDaysInMonth,
        overtimeDays,
        dailyRate,
        baseSalary,
        overtimeAmount,
        netSalary,
        multiplier,
      };
    });

    return {
      year: yearNum,
      month: monthNum,
      totalDays: totalDaysInMonth,
      mondaysInMonth,
      requiredWorkingDays,
      employees: previews,
      totalPayroll: previews.reduce((sum, p) => sum + p.netSalary, 0),
    };
  }

  @Get('runs')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  getAllPayrollRuns() {
    return this.payrollService.getAllPayrollRuns();
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  findPayrollRun(@Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.findPayrollRun(id);
  }

  @Post(':id/lock')
  @Roles(UserRole.SUPER_ADMIN)
  lockPayroll(@Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.lockPayroll(id);
  }

  @Post(':id/unlock')
  @Roles(UserRole.SUPER_ADMIN)
  unlockPayroll(@Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.unlockPayroll(id);
  }

  @Put('entry/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  updatePayrollEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      workingDays?: number;
      overtimeMultiplier?: number;
      overtimeAmount?: number;
      deductions?: number;
      status?: PayrollEntryStatus;
    }
  ) {
    return this.payrollService.updatePayrollEntry(id, body as any);
  }

  @Get('pdf/:entryId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  async generatePayslip(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Query('month') month: string,
    @Query('year') year: string,
    @Res() res: Response
  ) {
    const entry = await this.payrollService.getPayrollEntry(entryId);
    const pdfBuffer = await this.pdfService.generatePayslip(entry, parseInt(month), parseInt(year));

    const filename = this.pdfService.getFilename(
      entry.employee?.name || 'Employee',
      entry.employeeId,
      parseInt(month),
      parseInt(year)
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Get('payslip')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  async generatePayslipByEmployee(
    @Query('employeeId') employeeId: string,
    @Query('month') month: string,
    @Query('year') year: string,
    @Res() res: Response
  ) {
    const entry = await this.payrollService.getPayrollEntryByEmployeeAndMonth(
      employeeId,
      parseInt(year),
      parseInt(month)
    );

    if (!entry) {
      throw new NotFoundException(`No payroll entry found for this employee in ${year}-${month}`);
    }

    const pdfBuffer = await this.pdfService.generatePayslip(entry, parseInt(month), parseInt(year));

    const filename = this.pdfService.getFilename(
      entry.employee?.name || 'Employee',
      entry.employeeId,
      parseInt(month),
      parseInt(year)
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}
