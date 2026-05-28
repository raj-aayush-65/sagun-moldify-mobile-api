import { IsDateString, IsEnum, IsUUID, IsInt, Min, Max, IsOptional } from 'class-validator';
import { Shift } from '../enums/shift.enum';

export class CreatePackingRecordDto {
  @IsDateString()
  date: string;

  @IsEnum(Shift)
  shift: Shift;

  @IsUUID()
  partyId: string;

  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(50000)
  boxCount: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  looseCups?: number;
}

export class UpdatePackingRecordDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(Shift)
  shift?: Shift;

  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50000)
  boxCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  looseCups?: number;
}
