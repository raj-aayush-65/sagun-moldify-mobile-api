import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumberString,
} from 'class-validator';
import { ExpenseType } from '../enums/expense-type.enum';
import { ExpenseCategory } from '../enums/expense-category.enum';

export class ExpenseQueryDto {
  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsEnum(ExpenseType)
  expenseType?: ExpenseType;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  pageSize?: string;

  @IsOptional()
  @IsString()
  includeDeleted?: string;
}
