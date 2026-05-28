import {
  IsDateString,
  IsString,
  IsNumber,
  IsUUID,
  IsOptional,
  IsPositive,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateRollDto {
  @IsDateString()
  date: string;

  @IsString()
  @MaxLength(50)
  rollNo: string;

  @IsNumber()
  @Min(0.1)
  @Max(10.0)
  thickness: number;

  @IsNumber()
  @Min(50)
  @Max(2000)
  width: number;

  @IsString()
  @MaxLength(30)
  colour: string;

  @IsNumber()
  @IsPositive()
  @Max(99999.999)
  grossWeight: number;

  @IsNumber()
  @Min(0)
  @Max(99999.999)
  coreWeight: number;

  @IsUUID()
  sheetLineReportId: string;
}

export class UpdateRollDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  rollNo?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10.0)
  thickness?: number;

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(2000)
  width?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  colour?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(99999.999)
  grossWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999.999)
  coreWeight?: number;

  @IsOptional()
  @IsUUID()
  sheetLineReportId?: string;
}
