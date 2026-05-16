import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PayrollIntegrationService } from './payroll-integration.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeeAdvancesController {
  constructor(
    private readonly payrollIntegrationService: PayrollIntegrationService,
  ) {}

  @Get(':id/advances')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  async getEmployeeAdvances(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('month') month?: string,
  ) {
    // Default to current IST month if not provided
    const targetMonth = month || this.payrollIntegrationService.getCurrentISTMonth();

    // Validate month format YYYY-MM
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Month must be in YYYY-MM format',
          data: { code: 'INVALID_MONTH_FORMAT' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.payrollIntegrationService.getEmployeeAdvances(id, targetMonth);
    return ApiResponseDto.success('Employee advances fetched successfully', result);
  }
}
