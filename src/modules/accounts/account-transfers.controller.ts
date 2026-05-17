import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@Controller('account-transfers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountTransfersController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  async createTransfer(
    @Body() createTransferDto: CreateTransferDto,
    @CurrentUser('id') userId: string
  ) {
    const transfer = await this.accountsService.createTransfer(createTransferDto, userId);
    return ApiResponseDto.success('Transfer created successfully', transfer);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  async findAllTransfers() {
    const transfers = await this.accountsService.findAllTransfers();
    return ApiResponseDto.success('Transfers fetched successfully', transfers);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  async deleteTransfer(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    await this.accountsService.deleteTransfer(id, userId);
    return ApiResponseDto.success('Transfer deleted successfully');
  }
}
