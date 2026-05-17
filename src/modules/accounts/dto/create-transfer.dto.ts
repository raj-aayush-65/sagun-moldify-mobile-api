import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTransferDto {
  @IsUUID()
  @IsNotEmpty()
  fromAccountId: string;

  @IsUUID()
  @IsNotEmpty()
  toAccountId: string;

  @IsNumber()
  @Min(0.01, { message: 'amount must be greater than 0' })
  amount: number;

  @IsDateString()
  @IsNotEmpty()
  transferDate: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;
}
