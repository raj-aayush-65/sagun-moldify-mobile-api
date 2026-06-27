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
import { CompanyService } from '../services/company.service';
import { CreateCompanyDto, UpdateCompanyDto } from '../dto/company.dto';

@Controller('sales/companies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
export class CompaniesController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  async create(@Body() dto: CreateCompanyDto, @CurrentUser('id') userId: string) {
    const result = await this.companyService.create(dto, userId);
    return ApiResponseDto.success('Company created', result);
  }

  @Get()
  async findAll(@Query('isActive') isActive?: string) {
    const result = await this.companyService.findAll(
      isActive === 'true' ? true : isActive === 'false' ? false : undefined
    );
    return ApiResponseDto.success('Companies retrieved', result);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.companyService.findById(id);
    return ApiResponseDto.success('Company retrieved', result);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser('id') userId: string
  ) {
    const result = await this.companyService.update(id, dto, userId);
    return ApiResponseDto.success('Company updated', result);
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.companyService.delete(id);
    return ApiResponseDto.success('Company deleted');
  }
}
