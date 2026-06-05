import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { WastageService } from '../services/wastage.service';

@Controller('stock/finished-goods')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
export class FinishedGoodsController {
  constructor(private readonly wastageService: WastageService) {}

  @Get()
  async getFinishedGoods(
    @Query('partyId') partyId?: string,
    @Query('productId') productId?: string
  ) {
    const result = await this.wastageService.getFinishedGoods(partyId, productId);
    return ApiResponseDto.success('Finished goods retrieved', result);
  }
}
