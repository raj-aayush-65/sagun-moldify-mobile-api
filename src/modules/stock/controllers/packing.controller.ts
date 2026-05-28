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
import { PackingService } from '../services/packing.service';
import { CreatePackingRecordDto, UpdatePackingRecordDto } from '../dto/packing.dto';

@Controller('stock/packing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
export class PackingController {
  constructor(private readonly packingService: PackingService) {}

  @Post()
  async create(@Body() dto: CreatePackingRecordDto, @CurrentUser('id') userId: string) {
    const result = await this.packingService.create(dto, userId);
    return ApiResponseDto.success('Packing record created', result);
  }

  @Get()
  async list(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('shift') shift?: string,
    @Query('partyId') partyId?: string,
    @Query('productId') productId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const result = await this.packingService.list({
      dateFrom,
      dateTo,
      shift,
      partyId,
      productId,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
    return ApiResponseDto.success('Packing records retrieved', result);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.packingService.findById(id);
    return ApiResponseDto.success('Packing record retrieved', result);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePackingRecordDto,
    @CurrentUser('id') userId: string
  ) {
    const result = await this.packingService.update(id, dto, userId);
    return ApiResponseDto.success('Packing record updated', result);
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    await this.packingService.delete(id, userId);
    return ApiResponseDto.success('Packing record deleted');
  }
}
