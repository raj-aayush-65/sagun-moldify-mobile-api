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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { SaleService } from '../services/sale.service';
import { CreateSaleDto, UpdateSalePaymentDto } from '../dto/sale.dto';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
export class SalesController {
  constructor(private readonly saleService: SaleService) {}

  @Post()
  async create(@Body() dto: CreateSaleDto, @CurrentUser('id') userId: string) {
    const result = await this.saleService.create(dto, userId);
    return ApiResponseDto.success('Sale created', result);
  }

  @Get()
  async findAll(
    @Query('companyId') companyId?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const result = await this.saleService.findAll({
      companyId,
      paymentStatus,
      dateFrom,
      dateTo,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
    return ApiResponseDto.success('Sales retrieved', result);
  }

  @Get('summary')
  async getSummary() {
    const result = await this.saleService.getSalesSummary();
    return ApiResponseDto.success('Sales summary retrieved', result);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.saleService.findById(id);
    return ApiResponseDto.success('Sale retrieved', result);
  }

  @Patch(':id/payment')
  async updatePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalePaymentDto,
    @CurrentUser('id') userId: string
  ) {
    const result = await this.saleService.updatePayment(id, dto, userId);
    return ApiResponseDto.success('Payment status updated', result);
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.saleService.delete(id);
    return ApiResponseDto.success('Sale deleted');
  }
}
