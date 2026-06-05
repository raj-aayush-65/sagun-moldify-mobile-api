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
import { PrintingService } from '../services/printing.service';
import { CreatePrintingRecordDto, UpdatePrintingRecordDto } from '../dto/printing.dto';

@Controller('stock/printing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
export class PrintingController {
  constructor(private readonly printingService: PrintingService) {}

  @Post()
  async create(@Body() dto: CreatePrintingRecordDto, @CurrentUser('id') userId: string) {
    const result = await this.printingService.create(dto, userId);
    return ApiResponseDto.success('Printing record created', result);
  }

  @Get()
  async list(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('shift') shift?: string,
    @Query('printerMachine') printerMachine?: string,
    @Query('partyId') partyId?: string,
    @Query('productId') productId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const result = await this.printingService.list({
      dateFrom,
      dateTo,
      shift,
      printerMachine,
      partyId,
      productId,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
    return ApiResponseDto.success('Printing records retrieved', result);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.printingService.findById(id);
    return ApiResponseDto.success('Printing record retrieved', result);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrintingRecordDto,
    @CurrentUser('id') userId: string
  ) {
    const result = await this.printingService.update(id, dto, userId);
    return ApiResponseDto.success('Printing record updated', result);
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    await this.printingService.delete(id, userId);
    return ApiResponseDto.success('Printing record deleted');
  }
}
