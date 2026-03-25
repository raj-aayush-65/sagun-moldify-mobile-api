import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Attendance, AttendanceStatus, ShiftType } from './entities/attendance.entity';
import {
  CreateAttendanceDto,
  BulkAttendanceDto,
  MarkAllPresentDto,
  UpdateAttendanceDto,
  BulkRangeAttendanceDto,
} from './dto/create-attendance.dto';
import { EmployeesService } from '../employees/employees.service';

// IST timezone offset (UTC+5:30)
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

function toISTDate(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET);
}

function getISTDateString(date: Date): string {
  const istDate = toISTDate(date);
  return istDate.toISOString().split('T')[0];
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
    private employeesService: EmployeesService
  ) {}

  async create(createAttendanceDto: CreateAttendanceDto, userId: string): Promise<Attendance> {
    // Check if employee exists
    await this.employeesService.findOne(createAttendanceDto.employeeId);

    // Check if attendance already exists for this employee and date
    const existingAttendance = await this.attendanceRepository.findOne({
      where: {
        employeeId: createAttendanceDto.employeeId,
        attendanceDate: new Date(createAttendanceDto.attendanceDate),
      },
    });

    if (existingAttendance) {
      throw new BadRequestException(
        `Attendance already exists for this employee on ${createAttendanceDto.attendanceDate}`
      );
    }

    // Check if it's a Monday - if so, set status to WORKED_MONDAY if marked as present
    const date = new Date(createAttendanceDto.attendanceDate);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday

    const attendanceData: Partial<Attendance> = {
      employeeId: createAttendanceDto.employeeId,
      attendanceDate: new Date(createAttendanceDto.attendanceDate),
      status: createAttendanceDto.status || AttendanceStatus.PRESENT,
      shift: createAttendanceDto.shift || ShiftType.DAY_SHIFT,
      isHolidayWorked: createAttendanceDto.isHolidayWorked || false,
      overtimeMultiplier: createAttendanceDto.overtimeMultiplier || 1.0,
      createdBy: userId,
    };

    if (createAttendanceDto.balanceDate) {
      attendanceData.balanceDate = new Date(createAttendanceDto.balanceDate);
    }

    // Map perVisitRate for Occasional employees
    if (createAttendanceDto.perVisitRate !== undefined) {
      attendanceData.perVisitRate = createAttendanceDto.perVisitRate;
    }

    // Map perCupRate for Picker employees (legacy)
    if (createAttendanceDto.perCupRate !== undefined) {
      attendanceData.perCupRate = createAttendanceDto.perCupRate;
    }

    // Map cups-related fields for Picker employees
    if (createAttendanceDto.cupsCount !== undefined) {
      attendanceData.cupsCount = createAttendanceDto.cupsCount;
    }
    if (createAttendanceDto.cupsUnit) {
      attendanceData.cupsUnit = createAttendanceDto.cupsUnit;
    }
    if (createAttendanceDto.cupsRate !== undefined) {
      attendanceData.cupsRate = createAttendanceDto.cupsRate;
    }
    if (createAttendanceDto.cupsRateUnit) {
      attendanceData.cupsRateUnit = createAttendanceDto.cupsRateUnit;
    }

    const attendance = this.attendanceRepository.create(attendanceData);

    // Auto-set Monday as holiday worked
    if (dayOfWeek === 1 && createAttendanceDto.status === AttendanceStatus.PRESENT) {
      attendance.status = AttendanceStatus.WORKING;
      attendance.isHolidayWorked = true;
    }

    return this.attendanceRepository.save(attendance);
  }

  async createBulk(bulkDto: BulkAttendanceDto, userId: string): Promise<Attendance[]> {
    const results: Attendance[] = [];

    for (const record of bulkDto.attendanceRecords) {
      try {
        // Verify employee is Permanent before creating attendance
        const employee = await this.employeesService.findOne(record.employeeId);
        if (employee.employeeType !== 'PERMANENT') {
          // Skip non-permanent employees in bulk attendance
          continue;
        }

        const attendance = await this.create(record, userId);
        results.push(attendance);
      } catch (error) {
        // Skip if already exists, continue with others
        if (error instanceof BadRequestException) {
          continue;
        }
        throw error;
      }
    }

    return results;
  }

  async markAllPresent(markAllPresentDto: MarkAllPresentDto, userId: string): Promise<number> {
    const employees = await this.employeesService.getActiveEmployees();

    // Filter out excluded employees
    const excludeIds = markAllPresentDto.excludeEmployeeIds || [];
    const eligibleEmployees = employees.filter(e => !excludeIds.includes(e.id));

    let count = 0;
    const date = new Date(markAllPresentDto.attendanceDate);
    const dayOfWeek = date.getDay();

    for (const employee of eligibleEmployees) {
      // Check if attendance already exists
      const existingAttendance = await this.attendanceRepository.findOne({
        where: {
          employeeId: employee.id,
          attendanceDate: date,
        },
      });

      if (!existingAttendance) {
        let status = AttendanceStatus.PRESENT;
        let isHolidayWorked = false;

        // Auto-set Monday as WORKING
        if (dayOfWeek === 1) {
          status = AttendanceStatus.WORKING;
          isHolidayWorked = true;
        }

        const attendance = this.attendanceRepository.create({
          employeeId: employee.id,
          attendanceDate: date,
          status,
          shift: ShiftType.DAY_SHIFT,
          isHolidayWorked,
          createdBy: userId,
        });

        await this.attendanceRepository.save(attendance);
        count++;
      }
    }

    return count;
  }

  async createBulkRange(
    bulkRangeDto: BulkRangeAttendanceDto,
    userId: string
  ): Promise<{
    created: number;
    skipped: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let created = 0;
    let skipped = 0;

    // Determine date range based on mode
    let dates: Date[] = [];
    const currentDate = new Date();

    if (bulkRangeDto.mode === 'single') {
      dates = [new Date(bulkRangeDto.startDate)];
    } else if (bulkRangeDto.mode === 'range') {
      const start = new Date(bulkRangeDto.startDate);
      const end = new Date(bulkRangeDto.endDate || bulkRangeDto.startDate);

      // Validate dates are not before 01-11-2025
      const minDate = new Date('2025-11-01');
      if (start < minDate || end < minDate) {
        throw new BadRequestException('Cannot mark attendance before 01-11-2025');
      }

      // Generate all dates in range
      const current = new Date(start);
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    } else if (bulkRangeDto.mode === 'month') {
      const year = bulkRangeDto.year || currentDate.getFullYear();
      const month = bulkRangeDto.month || currentDate.getMonth() + 1;

      // Validate month is not before November 2025
      if (year < 2025 || (year === 2025 && month < 11)) {
        throw new BadRequestException('Cannot mark attendance before November 2025');
      }

      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);

      const current = new Date(start);
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    }

    // Validate date range is not before 01-11-2025
    const minDate = new Date('2025-11-01');
    if (dates.some(d => d < minDate)) {
      throw new BadRequestException('Cannot mark attendance before 01-11-2025');
    }

    // Get all employees to process
    const allEmployees = await this.employeesService.getActiveEmployees();

    // Filter to only include specified employees if provided
    const employeeIds = bulkRangeDto.employeeIds || [];
    const employees =
      employeeIds.length > 0 ? allEmployees.filter(e => employeeIds.includes(e.id)) : allEmployees;

    // Process each employee
    for (const employee of employees) {
      // Only process PERMANENT employees
      if (employee.employeeType !== 'PERMANENT') {
        continue;
      }

      // Process each date
      for (const date of dates) {
        try {
          // Check if attendance already exists
          const existingAttendance = await this.attendanceRepository.findOne({
            where: {
              employeeId: employee.id,
              attendanceDate: date,
            },
          });

          if (existingAttendance) {
            skipped++;
            continue;
          }

          // Determine status based on day of week
          const dayOfWeek = date.getDay();
          let status: AttendanceStatus;
          let isHolidayWorked = false;

          if (dayOfWeek === 1) {
            // Monday - use mondayStatus from DTO
            status = bulkRangeDto.mondayStatus || AttendanceStatus.HOLIDAY;
            if (status === AttendanceStatus.PRESENT || status === AttendanceStatus.WORKING) {
              isHolidayWorked = true;
            }
          } else {
            // Regular day - use workingDayStatus from DTO
            status = bulkRangeDto.workingDayStatus || AttendanceStatus.PRESENT;
          }

          const attendance = this.attendanceRepository.create({
            employeeId: employee.id,
            attendanceDate: date,
            status,
            shift: bulkRangeDto.shift || ShiftType.DAY_SHIFT,
            isHolidayWorked,
            createdBy: userId,
          });

          await this.attendanceRepository.save(attendance);
          created++;
        } catch (error) {
          if (error instanceof BadRequestException) {
            skipped++;
          } else {
            errors.push(
              `Error for employee ${employee.id} on ${date.toISOString().split('T')[0]}: ${error.message}`
            );
          }
        }
      }
    }

    return {
      created,
      skipped,
      errors: errors.length > 0 ? errors : [],
    };
  }

  async findAll(filters?: {
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    status?: AttendanceStatus;
  }): Promise<Attendance[]> {
    const query = this.attendanceRepository
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.employee', 'employee');

    if (filters?.employeeId) {
      query.andWhere('attendance.employeeId = :employeeId', {
        employeeId: filters.employeeId,
      });
    }

    if (filters?.startDate && filters?.endDate) {
      query.andWhere('attendance.attendanceDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(filters.startDate),
        endDate: new Date(filters.endDate),
      });
    }

    if (filters?.status) {
      query.andWhere('attendance.status = :status', { status: filters.status });
    }

    return query.orderBy('attendance.attendanceDate', 'DESC').getMany();
  }

  async findOne(id: string): Promise<Attendance> {
    const attendance = await this.attendanceRepository.findOne({
      where: { id },
      relations: ['employee'],
    });

    if (!attendance) {
      throw new NotFoundException(`Attendance with ID ${id} not found`);
    }

    return attendance;
  }

  async update(id: string, updateAttendanceDto: UpdateAttendanceDto): Promise<Attendance> {
    const attendance = await this.findOne(id);

    // If status changed to PRESENT on a Monday, auto-set to WORKING
    if (updateAttendanceDto.status === AttendanceStatus.PRESENT && attendance.attendanceDate) {
      const dayOfWeek = new Date(attendance.attendanceDate).getDay();
      if (dayOfWeek === 1) {
        updateAttendanceDto.status = AttendanceStatus.WORKING;
        updateAttendanceDto.isHolidayWorked = true;
      }
    }

    Object.assign(attendance, updateAttendanceDto);

    if (updateAttendanceDto.balanceDate) {
      attendance.balanceDate = new Date(updateAttendanceDto.balanceDate);
    }

    return this.attendanceRepository.save(attendance);
  }

  async remove(id: string): Promise<void> {
    const attendance = await this.findOne(id);
    await this.attendanceRepository.remove(attendance);
  }

  async getMonthlyAttendance(year: number, month: number): Promise<Attendance[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month

    return this.findAll({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    });
  }

  async getEmployeeAttendanceForMonth(
    employeeId: string,
    year: number,
    month: number
  ): Promise<Attendance[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    return this.attendanceRepository.find({
      where: {
        employeeId,
        attendanceDate: Between(startDate, endDate),
      },
      order: { attendanceDate: 'ASC' },
    });
  }

  async getAttendanceSummary(
    employeeId: string,
    year: number,
    month: number
  ): Promise<{
    present: number;
    absent: number;
    halfDay: number;
    workedMonday: number;
    totalDays: number;
  }> {
    const attendance = await this.getEmployeeAttendanceForMonth(employeeId, year, month);

    const present = attendance.filter(a => a.status === AttendanceStatus.PRESENT).length;
    const absent = attendance.filter(a => a.status === AttendanceStatus.ABSENT).length;
    const halfDay = attendance.filter(a => a.status === AttendanceStatus.HALF_DAY).length;
    const workedMonday = attendance.filter(a => a.status === AttendanceStatus.WORKING).length;

    // Count days in month
    const daysInMonth = new Date(year, month, 0).getDate();

    return {
      present,
      absent,
      halfDay,
      workedMonday,
      totalDays: daysInMonth,
    };
  }

  async checkAttendanceForDate(
    date: string
  ): Promise<Record<string, { status: string; shift: string; id: string }>> {
    // Get all attendance records for the given date
    const attendanceRecords = await this.attendanceRepository.find({
      where: {
        attendanceDate: new Date(date),
      },
      select: ['id', 'employeeId', 'status', 'shift'],
    });

    // Convert to a map for efficient lookup
    const attendanceMap: Record<string, { status: string; shift: string; id: string }> = {};

    for (const record of attendanceRecords) {
      attendanceMap[record.employeeId] = {
        status: record.status,
        shift: record.shift,
        id: record.id,
      };
    }

    return attendanceMap;
  }

  async getOrCreateDefaultAttendance(
    employeeId: string,
    date: Date,
    userId: string
  ): Promise<Attendance> {
    const dateStr = getISTDateString(date);
    const existingAttendance = await this.attendanceRepository.findOne({
      where: {
        employeeId,
        attendanceDate: new Date(dateStr),
      },
    });

    if (existingAttendance) {
      return existingAttendance;
    }

    // Check if it's a Monday - auto mark as PRESENT with isHolidayWorked flag
    const dayOfWeek = date.getDay();
    let status = AttendanceStatus.PRESENT;
    let isHolidayWorked = false;

    if (dayOfWeek === 1) {
      // Monday is a holiday - mark as PRESENT with isHolidayWorked flag
      status = AttendanceStatus.PRESENT;
      isHolidayWorked = true;
    }

    const attendance = this.attendanceRepository.create({
      employeeId,
      attendanceDate: new Date(dateStr),
      status,
      shift: ShiftType.DAY_SHIFT,
      isHolidayWorked,
      createdBy: userId,
    });

    return this.attendanceRepository.save(attendance);
  }
}
