import { IsString, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateStockEntryDto {
  @IsUUID()
  boxVariantId: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  entryDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
