import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { EmployeesService } from '../employees/employees.service';
import { AttendanceService } from '../attendance/attendance.service';
import { calculatePickerEarnings } from '../../common/utils/payroll.utils';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(
    private employeesService: EmployeesService,
    private attendanceService: AttendanceService
  ) {}

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  async getDashboardStats() {
    // Get current month/year
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Get active employees
    const activeEmployees = await this.employeesService.getActiveEmployees();
    const activeCount = activeEmployees.length;

    // Calculate Permanent employees total salary (monthly)
    const permanentEmployees = activeEmployees.filter((e: any) => e.employeeType === 'PERMANENT');
    const permanentTotal = permanentEmployees.reduce(
      (sum: number, e: any) => sum + (Number(e.monthlySalary) || 0),
      0
    );

    // Get current month attendance for picker/occasional earnings calculation
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);

    const monthAttendance = await this.attendanceService.findAll({
      startDate: startOfMonth.toISOString().split('T')[0],
      endDate: endOfMonth.toISOString().split('T')[0],
    });

    // Calculate picker earnings from attendance
    const pickerAttendance = monthAttendance.filter((a: any) => {
      const emp = activeEmployees.find((e: any) => e.id === a.employeeId);
      return emp?.employeeType === 'PICKER' && a.cupsRate;
    });
    const pickerEarnings = pickerAttendance.reduce((sum: number, a: any) => {
      return sum + calculatePickerEarnings(a.cupsCount, a.cupsUnit, a.cupsRate, a.cupsRateUnit);
    }, 0);

    // Calculate occasional earnings from attendance
    const occasionalAttendance = monthAttendance.filter((a: any) => {
      const emp = activeEmployees.find((e: any) => e.id === a.employeeId);
      return emp?.employeeType === 'OCCASIONAL' && a.perVisitRate;
    });
    const occasionalEarnings = occasionalAttendance.reduce(
      (sum: number, a: any) => sum + (Number(a.perVisitRate) || 0),
      0
    );

    // Total projected expense = Permanent + Picker + Occasional
    const projectedExpense = permanentTotal + pickerEarnings + occasionalEarnings;

    return {
      activeEmployees: activeCount,
      projectedExpense,
      permanentTotal,
      pickerEarnings,
      occasionalEarnings,
      year,
      month,
    };
  }

  @Get('today-attendance')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  async getTodayAttendance() {
    // Get today's date in IST
    const now = new Date();
    const today = new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get all attendance for today
    const attendance = await this.attendanceService.findAll({
      startDate: today,
      endDate: today,
    });

    return {
      data: attendance,
    };
  }
}
