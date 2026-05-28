import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { WastageService } from '../services/wastage.service';

@Controller('stock/wastage')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
export class WastageController {
  constructor(private readonly wastageService: WastageService) {}

  @Get('summary')
  async getWastageSummary(@Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    const result = await this.wastageService.getWastageSummary(dateFrom, dateTo);
    return ApiResponseDto.success('Wastage summary retrieved', result);
  }
}
