import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsOptional,
  IsUUID,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { ExpenseType } from '../enums/expense-type.enum';
import { ExpenseCategory } from '../enums/expense-category.enum';

export class CreateExpenseDto {
  @IsNumber()
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @IsDateString()
  @IsNotEmpty()
  expenseDate: string;

  @IsEnum(ExpenseType)
  expenseType: ExpenseType;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
