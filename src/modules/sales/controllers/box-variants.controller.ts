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
import { BoxVariantService } from '../services/box-variant.service';
import { CreateBoxVariantDto, UpdateBoxVariantDto } from '../dto/box-variant.dto';

@Controller('sales/box-variants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
export class BoxVariantsController {
  constructor(private readonly boxVariantService: BoxVariantService) {}

  @Post()
  async create(@Body() dto: CreateBoxVariantDto, @CurrentUser('id') userId: string) {
    const result = await this.boxVariantService.create(dto, userId);
    return ApiResponseDto.success('Box variant created', result);
  }

  @Get()
  async findAll(@Query('isActive') isActive?: string) {
    const result = await this.boxVariantService.findAll(
      isActive === 'true' ? true : isActive === 'false' ? false : undefined
    );
    return ApiResponseDto.success('Box variants retrieved', result);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.boxVariantService.findById(id);
    return ApiResponseDto.success('Box variant retrieved', result);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBoxVariantDto,
    @CurrentUser('id') userId: string
  ) {
    const result = await this.boxVariantService.update(id, dto, userId);
    return ApiResponseDto.success('Box variant updated', result);
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.boxVariantService.delete(id);
    return ApiResponseDto.success('Box variant deleted');
  }
}
