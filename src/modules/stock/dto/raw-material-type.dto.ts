import { IsString, IsBoolean, IsOptional, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateRawMaterialTypeDto {
  @IsString()
  @Length(1, 100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;
}

export class UpdateRawMaterialTypeDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
