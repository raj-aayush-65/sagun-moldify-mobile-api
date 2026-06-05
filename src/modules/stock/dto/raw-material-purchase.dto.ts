import {
  IsUUID,
  IsString,
  IsNumber,
  IsPositive,
  IsDateString,
  IsOptional,
  Max,
  Length,
} from 'class-validator';

export class CreateRawMaterialPurchaseDto {
  @IsUUID()
  materialTypeId: string;

  @IsString()
  @Length(1, 200)
  vendorName: string;

  @IsNumber()
  @IsPositive()
  @Max(99999.999)
  quantity: number;

  @IsNumber()
  @IsPositive()
  @Max(9999999.99)
  pricePerKg: number;

  @IsDateString()
  purchaseDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRawMaterialPurchaseDto {
  @IsOptional()
  @IsUUID()
  materialTypeId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  vendorName?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(99999.999)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(9999999.99)
  pricePerKg?: number;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
