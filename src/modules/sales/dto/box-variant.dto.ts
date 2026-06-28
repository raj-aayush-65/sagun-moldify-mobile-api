import { IsString, IsInt, IsOptional, IsBoolean, Length, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateBoxVariantDto {
  @IsString()
  @Length(1, 200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsInt()
  @Min(1)
  @Max(999999)
  piecesPerBox: number;
}

export class UpdateBoxVariantDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999999)
  piecesPerBox?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
