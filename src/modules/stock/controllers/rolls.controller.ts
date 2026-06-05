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
import { RollService } from '../services/roll.service';
import { CreateRollDto, UpdateRollDto } from '../dto/roll.dto';
import { RollStatus } from '../enums/roll-status.enum';

@Controller('stock/rolls')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
export class RollsController {
  constructor(private readonly rollService: RollService) {}

  @Post()
  async create(@Body() dto: CreateRollDto, @CurrentUser('id') userId: string) {
    const result = await this.rollService.create(dto, userId);
    return ApiResponseDto.success('Roll created', result);
  }

  @Get()
  async list(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('colour') colour?: string,
    @Query('status') status?: RollStatus,
    @Query('sheetLineReportId') sheetLineReportId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const result = await this.rollService.list({
      dateFrom,
      dateTo,
      colour,
      status,
      sheetLineReportId,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
    return ApiResponseDto.success('Rolls retrieved', result);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.rollService.findById(id);
    return ApiResponseDto.success('Roll retrieved', result);
  }

  @Get(':id/trace')
  async getTrace(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.rollService.getTrace(id);
    return ApiResponseDto.success('Roll trace retrieved', result);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRollDto,
    @CurrentUser('id') userId: string
  ) {
    const result = await this.rollService.update(id, dto, userId);
    return ApiResponseDto.success('Roll updated', result);
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.rollService.delete(id);
    return ApiResponseDto.success('Roll deleted');
  }
}
