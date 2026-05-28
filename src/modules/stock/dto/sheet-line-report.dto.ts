import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsUUID,
  IsPositive,
  Min,
  Max,
  MaxLength,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Shift } from '../enums/shift.enum';
import { WastageCategory } from '../enums/wastage-category.enum';

export class MaterialUsageEntryDto {
  @IsUUID()
  materialTypeId: string;

  @IsNumber()
  @Min(0.01)
  @Max(99999.99)
  quantityUsed: number;
}

export class MixRatioEntryDto {
  @IsUUID()
  materialTypeId: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  proportion: number;
}

export class WastageEntryDto {
  @IsEnum(WastageCategory)
  wastageCategory: WastageCategory;

  @IsNumber()
  @Min(0)
  @Max(99999.99)
  weight: number;
}

export class RollEntryDto {
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
}

export class CreateSheetLineReportDto {
  @IsDateString()
  date: string;

  @IsEnum(Shift)
  shift: Shift;

  @ValidateNested({ each: true })
  @Type(() => MaterialUsageEntryDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  materialUsage: MaterialUsageEntryDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MixRatioEntryDto)
  mixRatio?: MixRatioEntryDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WastageEntryDto)
  @ArrayMaxSize(20)
  wastage?: WastageEntryDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RollEntryDto)
  @ArrayMaxSize(100)
  rolls?: RollEntryDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class UpdateSheetLineReportDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(Shift)
  shift?: Shift;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MaterialUsageEntryDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  materialUsage?: MaterialUsageEntryDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MixRatioEntryDto)
  mixRatio?: MixRatioEntryDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WastageEntryDto)
  @ArrayMaxSize(20)
  wastage?: WastageEntryDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RollEntryDto)
  @ArrayMaxSize(100)
  rolls?: RollEntryDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
