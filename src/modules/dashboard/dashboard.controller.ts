import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { EmployeesService } from '../employees/employees.service';
import { AttendanceService } from '../attendance/attendance.service';

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

    // Get active employees count
    const activeEmployees = await this.employeesService.getActiveEmployees();
    const activeCount = activeEmployees.length;

    // Get permanent employees for projected expense
    const permanentEmployees = activeEmployees.filter((e: any) => e.employeeType === 'PERMANENT');
    const projectedExpense = permanentEmployees.reduce(
      (sum: number, e: any) => sum + (Number(e.monthlySalary) || 0),
      0
    );

    // Note: Today's attendance would need additional implementation
    // Can be added by calling attendanceService.getTodayAttendance()

    return {
      activeEmployees: activeCount,
      projectedExpense,
      year,
      month,
    };
  }
}
