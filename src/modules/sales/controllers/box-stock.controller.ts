import {
  Controller,
  Get,
  Post,
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
import { BoxStockService } from '../services/box-stock.service';
import { CreateStockEntryDto } from '../dto/stock-entry.dto';

@Controller('sales/stock')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
export class BoxStockController {
  constructor(private readonly boxStockService: BoxStockService) {}

  @Post()
  async addStock(@Body() dto: CreateStockEntryDto, @CurrentUser('id') userId: string) {
    const result = await this.boxStockService.addStock(dto, userId);
    return ApiResponseDto.success('Stock added', result);
  }

  @Get('entries')
  async getEntries(
    @Query('boxVariantId') boxVariantId?: string,
    @Query('companyId') companyId?: string
  ) {
    const result = await this.boxStockService.getStockEntries(boxVariantId, companyId);
    return ApiResponseDto.success('Stock entries retrieved', result);
  }

  @Get('levels')
  async getLevels(@Query('companyId') companyId?: string) {
    const result = await this.boxStockService.getCurrentStockLevels(companyId);
    return ApiResponseDto.success('Stock levels retrieved', result);
  }

  @Get('levels/by-company')
  async getLevelsByCompany() {
    const result = await this.boxStockService.getStockLevelsByCompany();
    return ApiResponseDto.success('Stock levels by company retrieved', result);
  }

  @Delete('entries/:id')
  async deleteEntry(@Param('id', ParseUUIDPipe) id: string) {
    await this.boxStockService.deleteStockEntry(id);
    return ApiResponseDto.success('Stock entry deleted');
  }
}
