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
import { AttendanceStatus, ShiftType } from '../entities/attendance.entity';

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
}
