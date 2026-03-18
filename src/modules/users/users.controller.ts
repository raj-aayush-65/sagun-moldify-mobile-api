import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  @ApiOperation({ summary: 'Get all users (Super Admin/Super User only)' })
  async findAll() {
    const users = await this.usersService.findAll();
    return ApiResponseDto.success('Users fetched successfully', users);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.findOne(id);
    return ApiResponseDto.success('User fetched successfully', user);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  @ApiOperation({ summary: 'Create new user (Admin only)' })
  async create(@Body() createUserDto: CreateUserDto, @Request() req: any) {
    const user = await this.usersService.create(createUserDto, req.user.id);
    return ApiResponseDto.success('User created successfully', user);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  @ApiOperation({ summary: 'Update user (Admin only)' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() updateUserDto: UpdateUserDto) {
    const user = await this.usersService.update(id, updateUserDto);
    return ApiResponseDto.success('User updated successfully', user);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate user (Super Admin only)' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.usersService.deactivate(id);
    return ApiResponseDto.success('User deactivated successfully', result);
  }
}
