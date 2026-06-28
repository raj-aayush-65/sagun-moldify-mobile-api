import { IsString, IsOptional, IsBoolean, Length, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCompanyDto {
  @IsString()
  @Length(1, 200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gstNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactPerson?: string;
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gstNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactPerson?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
