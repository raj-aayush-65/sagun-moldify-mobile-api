import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { RawMaterialService } from '../services/raw-material.service';

@Controller('stock/raw-materials')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
export class RawMaterialLevelsController {
  constructor(private readonly rawMaterialService: RawMaterialService) {}

  @Get('levels')
  async getStockLevels(@Query('date') date?: string) {
    const result = await this.rawMaterialService.getStockLevels(date);
    return ApiResponseDto.success('Stock levels retrieved', result);
  }
}
