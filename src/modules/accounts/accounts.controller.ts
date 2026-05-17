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
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@Controller('accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  async create(@Body() createAccountDto: CreateAccountDto, @CurrentUser('id') userId: string) {
    const account = await this.accountsService.create(createAccountDto, userId);
    return ApiResponseDto.success('Account created successfully', account);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  async findAll(@Query('includeArchived') includeArchived?: string) {
    const accounts = await this.accountsService.findAll({
      includeArchived: includeArchived === 'true',
    });
    return ApiResponseDto.success('Accounts fetched successfully', accounts);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const account = await this.accountsService.findById(id);
    return ApiResponseDto.success('Account fetched successfully', account);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAccountDto: UpdateAccountDto,
    @CurrentUser('id') userId: string
  ) {
    const account = await this.accountsService.update(id, updateAccountDto, userId);
    return ApiResponseDto.success('Account updated successfully', account);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('archive') archive: string,
    @CurrentUser('id') userId: string
  ) {
    if (archive === 'true') {
      const account = await this.accountsService.archive(id, userId);
      return ApiResponseDto.success('Account archived successfully', account);
    }
    const result = await this.accountsService.delete(id, userId);
    return ApiResponseDto.success('Account deleted successfully', result);
  }

  // --- Recompute balance endpoint ---

  @Post(':id/recompute-balance')
  @Roles(UserRole.SUPER_ADMIN)
  async recomputeBalance(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.accountsService.recomputeBalance(id);
    return ApiResponseDto.success('Balance recomputed successfully', result);
  }

  // --- Add balance (credit/deposit) endpoint ---

  @Post(':id/add-balance')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  async addBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { amount: number; description: string; sourceType?: string; sourceId?: string },
    @CurrentUser('id') userId: string
  ) {
    const account = await this.accountsService.addBalance(id, body, userId);
    return ApiResponseDto.success('Balance added successfully', account);
  }
}
