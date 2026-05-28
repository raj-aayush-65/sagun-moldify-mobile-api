import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { StockDashboardService } from '../services/stock-dashboard.service';

@Controller('stock/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
export class DashboardController {
  constructor(private readonly stockDashboardService: StockDashboardService) {}

  @Get()
  async getDashboard(@Query('date') date?: string) {
    const result = await this.stockDashboardService.getDashboard(date);
    return ApiResponseDto.success('Dashboard data retrieved', result);
  }
}
