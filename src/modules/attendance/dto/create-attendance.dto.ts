import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceStatus, ShiftType, CupsUnit } from '../entities/attendance.entity';

export class CreateAttendanceDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsDateString()
  attendanceDate: string;

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @IsEnum(ShiftType)
  @IsOptional()
  shift?: ShiftType;

  @IsBoolean()
  @IsOptional()
  isHolidayWorked?: boolean;

  @IsDateString()
  @IsOptional()
  balanceDate?: string;

  @IsNumber()
  @IsOptional()
  overtimeMultiplier?: number;

  // For OCCASIONAL employees - rate per visit
  @IsNumber()
  @IsOptional()
  perVisitRate?: number;

  // For PICKER employees - legacy rate per cup (single rate)
  @IsNumber()
  @IsOptional()
  perCupRate?: number;

  // For PICKER employees - cups count (in selected unit)
  @IsNumber()
  @IsOptional()
  cupsCount?: number;

  // For PICKER employees - cups unit (PER_100, PER_THOUSAND, PER_10_THOUSAND)
  @IsEnum(CupsUnit)
  @IsOptional()
  cupsUnit?: CupsUnit;

  // For PICKER employees - rate per selected unit
  @IsNumber()
  @IsOptional()
  cupsRate?: number;

  // For PICKER employees - rate unit (can be different from cups unit)
  @IsEnum(CupsUnit)
  @IsOptional()
  cupsRateUnit?: CupsUnit;
}

export class BulkAttendanceDto {
  @IsDateString()
  attendanceDate: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAttendanceDto)
  attendanceRecords: CreateAttendanceDto[];
}

export class MarkAllPresentDto {
  @IsDateString()
  attendanceDate: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  excludeEmployeeIds?: string[];
}

export class UpdateAttendanceDto {
  @IsEnum(AttendanceStatus)
  @IsOptional()
  status?: AttendanceStatus;

  @IsEnum(ShiftType)
  @IsOptional()
  shift?: ShiftType;

  @IsBoolean()
  @IsOptional()
  isHolidayWorked?: boolean;

  @IsDateString()
  @IsOptional()
  balanceDate?: string;

  @IsNumber()
  @IsOptional()
  overtimeMultiplier?: number;

  // For OCCASIONAL employees - rate per visit
  @IsNumber()
  @IsOptional()
  perVisitRate?: number;

  // For PICKER employees - legacy rate per cup
  @IsNumber()
  @IsOptional()
  perCupRate?: number;

  // For PICKER employees - cups count
  @IsNumber()
  @IsOptional()
  cupsCount?: number;

  // For PICKER employees - cups unit
  @IsEnum(CupsUnit)
  @IsOptional()
  cupsUnit?: CupsUnit;

  // For PICKER employees - rate
  @IsNumber()
  @IsOptional()
  cupsRate?: number;

  // For PICKER employees - rate unit
  @IsEnum(CupsUnit)
  @IsOptional()
  cupsRateUnit?: CupsUnit;
}

export class BulkRangeAttendanceDto {
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @IsOptional()
  month?: number;

  @IsNumber()
  @IsOptional()
  year?: number;

  @IsEnum(['single', 'range', 'month'])
  mode: 'single' | 'range' | 'month';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  employeeIds?: string[];

  @IsEnum(AttendanceStatus)
  @IsOptional()
  mondayStatus?: AttendanceStatus;

  @IsEnum(AttendanceStatus)
  @IsOptional()
  workingDayStatus?: AttendanceStatus;

  @IsEnum(ShiftType)
  @IsOptional()
  shift?: ShiftType;
}
