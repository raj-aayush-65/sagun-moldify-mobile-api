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
import { PartyService } from '../services/party.service';
import { CreatePartyDto, UpdatePartyDto } from '../dto/party.dto';

@Controller('stock/parties')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
export class PartiesController {
  constructor(private readonly partyService: PartyService) {}

  @Post()
  async create(@Body() dto: CreatePartyDto, @CurrentUser('id') userId: string) {
    const result = await this.partyService.create(dto, userId);
    return ApiResponseDto.success('Party created', result);
  }

  @Get()
  async list(
    @Query('name') name?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const result = await this.partyService.list({
      name,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
    return ApiResponseDto.success('Parties retrieved', result);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.partyService.findById(id);
    return ApiResponseDto.success('Party retrieved', result);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartyDto,
    @CurrentUser('id') userId: string
  ) {
    const result = await this.partyService.update(id, dto, userId);
    return ApiResponseDto.success('Party updated', result);
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.partyService.delete(id);
    return ApiResponseDto.success('Party deleted');
  }
}
