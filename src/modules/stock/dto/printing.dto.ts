import { IsDateString, IsEnum, IsUUID, IsInt, Min, Max, IsOptional } from 'class-validator';
import { Shift } from '../enums/shift.enum';
import { PrinterMachine } from '../enums/printer-machine.enum';

export class CreatePrintingRecordDto {
  @IsDateString()
  date: string;

  @IsEnum(Shift)
  shift: Shift;

  @IsEnum(PrinterMachine)
  printerMachine: PrinterMachine;

  @IsUUID()
  partyId: string;

  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(999999)
  quantity: number;
}

export class UpdatePrintingRecordDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(Shift)
  shift?: Shift;

  @IsOptional()
  @IsEnum(PrinterMachine)
  printerMachine?: PrinterMachine;

  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999999)
  quantity?: number;
}
