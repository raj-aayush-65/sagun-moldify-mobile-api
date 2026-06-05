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
import { RawMaterialService } from '../services/raw-material.service';
import {
  CreateRawMaterialPurchaseDto,
  UpdateRawMaterialPurchaseDto,
} from '../dto/raw-material-purchase.dto';

@Controller('stock/purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
export class RawMaterialPurchasesController {
  constructor(private readonly rawMaterialService: RawMaterialService) {}

  @Post()
  async createPurchase(
    @Body() dto: CreateRawMaterialPurchaseDto,
    @CurrentUser('id') userId: string
  ) {
    const result = await this.rawMaterialService.createPurchase(dto, userId);
    return ApiResponseDto.success('Purchase created', result);
  }

  @Get()
  async listPurchases(
    @Query('materialTypeId') materialTypeId?: string,
    @Query('vendorName') vendorName?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const result = await this.rawMaterialService.listPurchases({
      materialTypeId,
      vendorName,
      dateFrom,
      dateTo,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
    return ApiResponseDto.success('Purchases retrieved', result);
  }

  @Get(':id')
  async getPurchaseById(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.rawMaterialService.getPurchaseById(id);
    return ApiResponseDto.success('Purchase retrieved', result);
  }

  @Patch(':id')
  async updatePurchase(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRawMaterialPurchaseDto,
    @CurrentUser('id') userId: string
  ) {
    const result = await this.rawMaterialService.updatePurchase(id, dto, userId);
    return ApiResponseDto.success('Purchase updated', result);
  }

  @Delete(':id')
  async deletePurchase(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    await this.rawMaterialService.deletePurchase(id, userId);
    return ApiResponseDto.success('Purchase deleted');
  }
}
