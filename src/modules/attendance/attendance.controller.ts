import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import {
  CreateAttendanceDto,
  BulkAttendanceDto,
  MarkAllPresentDto,
  UpdateAttendanceDto,
  BulkRangeAttendanceDto,
} from './dto/create-attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AttendanceStatus, ShiftType } from './entities/attendance.entity';

interface AuthRequest {
  user: {
    id: string;
    role: UserRole;
  };
}

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  create(@Body() createAttendanceDto: CreateAttendanceDto, @Request() req: AuthRequest) {
    return this.attendanceService.create(createAttendanceDto, req.user.id);
  }

  @Post('bulk')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  createBulk(@Body() bulkDto: BulkAttendanceDto, @Request() req: AuthRequest) {
    return this.attendanceService.createBulk(bulkDto, req.user.id);
  }

  @Post('mark-all-present')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  markAllPresent(@Body() markAllPresentDto: MarkAllPresentDto, @Request() req: AuthRequest) {
    return this.attendanceService.markAllPresent(markAllPresentDto, req.user.id);
  }

  @Post('bulk-range')
  @Roles(UserRole.SUPER_ADMIN)
  createBulkRange(@Body() bulkRangeDto: BulkRangeAttendanceDto, @Request() req: AuthRequest) {
    return this.attendanceService.createBulkRange(bulkRangeDto, req.user.id);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: AttendanceStatus,
    @Query('shift') shift?: ShiftType
  ) {
    return this.attendanceService.findAll({
      employeeId,
      startDate,
      endDate,
      status,
      shift,
    });
  }

  @Get('month/:year/:month')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  getMonthlyAttendance(@Param('year') year: string, @Param('month') month: string) {
    return this.attendanceService.getMonthlyAttendance(parseInt(year), parseInt(month));
  }

  @Get('employee/:employeeId/month/:year/:month')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  getEmployeeAttendanceForMonth(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('year') year: string,
    @Param('month') month: string
  ) {
    return this.attendanceService.getEmployeeAttendanceForMonth(
      employeeId,
      parseInt(year),
      parseInt(month)
    );
  }

  @Get('employee/:employeeId/summary/:year/:month')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  getAttendanceSummary(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('year') year: string,
    @Param('month') month: string
  ) {
    return this.attendanceService.getAttendanceSummary(employeeId, parseInt(year), parseInt(month));
  }

  @Get('check/:date')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  checkAttendanceForDate(@Param('date') date: string) {
    return this.attendanceService.checkAttendanceForDate(date);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.attendanceService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateAttendanceDto: UpdateAttendanceDto) {
    return this.attendanceService.update(id, updateAttendanceDto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.attendanceService.remove(id);
  }
}
