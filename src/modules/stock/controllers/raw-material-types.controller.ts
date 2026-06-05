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
import { RawMaterialService } from '../services/raw-material.service';
import { CreateRawMaterialTypeDto, UpdateRawMaterialTypeDto } from '../dto/raw-material-type.dto';

@Controller('stock/material-types')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
export class RawMaterialTypesController {
  constructor(private readonly rawMaterialService: RawMaterialService) {}

  @Post()
  async createType(@Body() dto: CreateRawMaterialTypeDto, @CurrentUser('id') userId: string) {
    const result = await this.rawMaterialService.createType(dto, userId);
    return ApiResponseDto.success('Material type created', result);
  }

  @Get()
  async listTypes(@Query('isActive') isActive?: string) {
    const isActiveFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    const result = await this.rawMaterialService.listTypes(isActiveFilter);
    return ApiResponseDto.success('Material types retrieved', result);
  }

  @Patch(':id')
  async updateType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRawMaterialTypeDto,
    @CurrentUser('id') userId: string
  ) {
    const result = await this.rawMaterialService.updateType(id, dto, userId);
    return ApiResponseDto.success('Material type updated', result);
  }

  @Delete(':id')
  async deleteType(@Param('id', ParseUUIDPipe) id: string) {
    await this.rawMaterialService.deleteType(id);
    return ApiResponseDto.success('Material type deleted');
  }
}
