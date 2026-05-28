import {
  IsUUID,
  IsNumber,
  IsPositive,
  Max,
  Min,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  IsInt,
  IsDateString,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Shift } from '../enums/shift.enum';
import { RollStatus } from '../enums/roll-status.enum';

export class RollConsumptionEntryDto {
  @IsUUID()
  rollId: string;

  @IsNumber()
  @IsPositive()
  @Max(9999.999)
  rollWeight: number;

  @IsNumber()
  @Min(0)
  @Max(9999.999)
  wastage: number;

  @IsEnum(RollStatus)
  shiftEndStatus: RollStatus;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  remainingWeight?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class ProductionOutputEntryDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(999999)
  quantity: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99999)
  looseCount?: number;
}

export class CreateTfmProductionDto {
  @IsDateString()
  date: string;

  @IsEnum(Shift)
  shift: Shift;

  @ValidateNested({ each: true })
  @Type(() => RollConsumptionEntryDto)
  @ArrayMinSize(1)
  rollConsumptions: RollConsumptionEntryDto[];

  @ValidateNested({ each: true })
  @Type(() => ProductionOutputEntryDto)
  @ArrayMinSize(1)
  productionOutputs: ProductionOutputEntryDto[];
}

export class UpdateTfmProductionDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(Shift)
  shift?: Shift;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RollConsumptionEntryDto)
  @ArrayMinSize(1)
  rollConsumptions?: RollConsumptionEntryDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProductionOutputEntryDto)
  @ArrayMinSize(1)
  productionOutputs?: ProductionOutputEntryDto[];
}
