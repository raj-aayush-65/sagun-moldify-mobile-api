import {
  IsString,
  IsNumber,
  IsInt,
  IsBoolean,
  IsOptional,
  Length,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @Length(1, 200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsString()
  @Length(1, 50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  size: string;

  @IsString()
  @Length(1, 50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  volume: string;

  @IsString()
  @Length(1, 50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  colour: string;

  @IsNumber()
  @Min(0.01)
  @Max(999.99)
  weightPerCup: number;

  @IsInt()
  @Min(1)
  @Max(99999)
  quantityPerBox: number;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  size?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  volume?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  colour?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(999.99)
  weightPerCup?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99999)
  quantityPerBox?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
