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
import { ProductService } from '../services/product.service';
import { CreateProductDto, UpdateProductDto } from '../dto/product.dto';

@Controller('stock/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
export class ProductsController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  async create(@Body() dto: CreateProductDto, @CurrentUser('id') userId: string) {
    const result = await this.productService.create(dto, userId);
    return ApiResponseDto.success('Product created', result);
  }

  @Get()
  async list(
    @Query('name') name?: string,
    @Query('size') size?: string,
    @Query('colour') colour?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const result = await this.productService.list({
      name,
      size,
      colour,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
    return ApiResponseDto.success('Products retrieved', result);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.productService.findById(id);
    return ApiResponseDto.success('Product retrieved', result);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser('id') userId: string
  ) {
    const result = await this.productService.update(id, dto, userId);
    return ApiResponseDto.success('Product updated', result);
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.productService.delete(id);
    return ApiResponseDto.success('Product deleted');
  }
}
