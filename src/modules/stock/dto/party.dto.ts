import { IsString, IsBoolean, IsOptional, Length, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePartyDto {
  @IsString()
  @Length(1, 200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  contactInfo?: string;
}

export class UpdatePartyDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  contactInfo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
