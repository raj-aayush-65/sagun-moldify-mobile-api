import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { PayrollIntegrationService } from './payroll-integration.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly payrollIntegrationService: PayrollIntegrationService,
  ) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  async create(
    @Body() createExpenseDto: CreateExpenseDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    const expense = await this.expensesService.create(createExpenseDto, {
      id: user.id,
      role: user.role,
      isSuperAdmin: user.role === UserRole.SUPER_ADMIN,
    });
    return ApiResponseDto.success('Expense created successfully', expense);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  async findAll(
    @Query() query: ExpenseQueryDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    const result = await this.expensesService.findAll(
      {
        month: query.month,
        expenseType: query.expenseType,
        category: query.category,
        accountId: query.accountId,
        employeeId: query.employeeId,
        search: query.search,
        page: query.page ? parseInt(query.page, 10) : undefined,
        pageSize: query.pageSize ? parseInt(query.pageSize, 10) : undefined,
        includeDeleted: query.includeDeleted === 'true',
      },
      {
        id: user.id,
        role: user.role,
        isSuperAdmin: user.role === UserRole.SUPER_ADMIN,
      },
    );
    return ApiResponseDto.success('Expenses fetched successfully', result);
  }

  @Get('summary')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  async getSummary(
    @Query('month') month: string | undefined,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    const summary = await this.expensesService.getSummary(month, {
      id: user.id,
      role: user.role,
      isSuperAdmin: user.role === UserRole.SUPER_ADMIN,
    });
    return ApiResponseDto.success('Expense summary fetched successfully', summary);
  }

  @Get('config')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  getConfig() {
    const config = this.expensesService.getConfig();
    return ApiResponseDto.success('Expense config fetched successfully', config);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const expense = await this.expensesService.findOne(id);
    return ApiResponseDto.success('Expense fetched successfully', expense);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateExpenseDto: UpdateExpenseDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    const expense = await this.expensesService.update(id, updateExpenseDto, {
      id: user.id,
      role: user.role,
      isSuperAdmin: user.role === UserRole.SUPER_ADMIN,
    });
    return ApiResponseDto.success('Expense updated successfully', expense);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    const expense = await this.expensesService.softDelete(id, {
      id: user.id,
      role: user.role,
      isSuperAdmin: user.role === UserRole.SUPER_ADMIN,
    });
    return ApiResponseDto.success('Expense deleted successfully', expense);
  }

  @Post(':id/refunds')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  async createRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createRefundDto: CreateRefundDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    // Enforce SUPER_ADMIN only — reject others with REFUND_FORBIDDEN_ROLE
    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Only SUPER_ADMIN can create refunds',
          data: { code: 'REFUND_FORBIDDEN_ROLE' },
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const refund = await this.expensesService.createRefund(
      id,
      createRefundDto,
      user.id,
    );
    return ApiResponseDto.success('Refund created successfully', refund);
  }

  @Get(':id/refunds')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  async findRefunds(@Param('id', ParseUUIDPipe) id: string) {
    const refunds = await this.expensesService.findRefundsByExpense(id);
    return ApiResponseDto.success('Refunds fetched successfully', refunds);
  }
}
