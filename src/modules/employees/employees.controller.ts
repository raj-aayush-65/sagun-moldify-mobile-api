import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { EmployeeType } from './entities/employee.entity';

interface AuthRequest {
  user: {
    id: string;
    role: UserRole;
  };
}

@Controller('api/employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  create(@Body() createEmployeeDto: CreateEmployeeDto, @Request() req: AuthRequest) {
    return this.employeesService.create(createEmployeeDto, req.user.id);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('employeeType') employeeType?: EmployeeType,
    @Query('isActive') isActive?: string
  ) {
    const filters = {
      employeeType: employeeType ? (employeeType as EmployeeType) : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    };

    return this.employeesService.findAll(
      filters,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20
    );
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateEmployeeDto: UpdateEmployeeDto) {
    return this.employeesService.update(id, updateEmployeeDto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.remove(id);
  }

  @Post(':id/activate')
  @Roles(UserRole.SUPER_ADMIN)
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.activate(id);
  }

  @Get('stats/count')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  getEmployeeCount() {
    return this.employeesService.getEmployeeCount();
  }

  @Get('active/all')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  getActiveEmployees() {
    return this.employeesService.getActiveEmployees();
  }

  @Get('type/:type')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPER_USER, UserRole.HIGHER_OPS)
  getEmployeesByType(@Param('type') type: EmployeeType) {
    return this.employeesService.getEmployeesByType(type);
  }
}
