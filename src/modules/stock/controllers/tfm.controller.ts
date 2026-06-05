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
import { TfmService } from '../services/tfm.service';
import { CreateTfmProductionDto, UpdateTfmProductionDto } from '../dto/tfm-production.dto';

@Controller('stock/tfm')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
export class TfmController {
  constructor(private readonly tfmService: TfmService) {}

  @Post()
  async createRecord(@Body() dto: CreateTfmProductionDto, @CurrentUser('id') userId: string) {
    const result = await this.tfmService.createRecord(dto, userId);
    return ApiResponseDto.success('TFM production record created', result);
  }

  @Get()
  async listRecords(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('shift') shift?: string,
    @Query('rollId') rollId?: string,
    @Query('productId') productId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const result = await this.tfmService.listRecords({
      dateFrom,
      dateTo,
      shift,
      rollId,
      productId,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
    return ApiResponseDto.success('TFM production records retrieved', result);
  }

  @Get(':id')
  async getRecordById(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.tfmService.getRecordById(id);
    return ApiResponseDto.success('TFM production record retrieved', result);
  }

  @Patch(':id')
  async updateRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTfmProductionDto,
    @CurrentUser('id') userId: string
  ) {
    const result = await this.tfmService.updateRecord(id, dto, userId);
    return ApiResponseDto.success('TFM production record updated', result);
  }

  @Delete(':id')
  async deleteRecord(@Param('id', ParseUUIDPipe) id: string) {
    await this.tfmService.deleteRecord(id);
    return ApiResponseDto.success('TFM production record deleted');
  }
}
