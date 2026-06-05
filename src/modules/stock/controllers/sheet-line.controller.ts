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
import { SheetLineService } from '../services/sheet-line.service';
import { CreateSheetLineReportDto, UpdateSheetLineReportDto } from '../dto/sheet-line-report.dto';

@Controller('stock/sheet-line')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
export class SheetLineController {
  constructor(private readonly sheetLineService: SheetLineService) {}

  @Post()
  async createReport(@Body() dto: CreateSheetLineReportDto, @CurrentUser('id') userId: string) {
    const result = await this.sheetLineService.createReport(dto, userId);
    return ApiResponseDto.success('Sheet line report created', result);
  }

  @Get()
  async listReports(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('shift') shift?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const result = await this.sheetLineService.listReports({
      dateFrom,
      dateTo,
      shift,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
    return ApiResponseDto.success('Sheet line reports retrieved', result);
  }

  @Get(':id')
  async getReportById(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.sheetLineService.getReportById(id);
    return ApiResponseDto.success('Sheet line report retrieved', result);
  }

  @Patch(':id')
  async updateReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSheetLineReportDto,
    @CurrentUser('id') userId: string
  ) {
    const result = await this.sheetLineService.updateReport(id, dto, userId);
    return ApiResponseDto.success('Sheet line report updated', result);
  }

  @Delete(':id')
  async deleteReport(@Param('id', ParseUUIDPipe) id: string) {
    await this.sheetLineService.deleteReport(id);
    return ApiResponseDto.success('Sheet line report deleted');
  }
}
