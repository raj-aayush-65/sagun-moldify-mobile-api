import { IsString, IsNotEmpty, IsNumber, IsDateString, MaxLength, Min } from 'class-validator';

export class CreateRefundDto {
  @IsNumber()
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount: number;

  @IsDateString()
  @IsNotEmpty()
  refundDate: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;
}
