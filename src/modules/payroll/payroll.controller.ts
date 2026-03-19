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
} from '@nestjs/common';
import { Response } from 'express';
import { PayrollService } from './payroll.service';
import { PdfService } from './pdf.service';
import { PayrollEntryStatus } from './entities/payroll-entry.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

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
    @Body() body: { year: number; month: number; overtimeMultiplier?: number },
    @Request() req: AuthRequest
  ) {
    return this.payrollService.runPayroll(
      body.year,
      body.month,
      req.user.id,
      false,
      body.overtimeMultiplier
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
}
