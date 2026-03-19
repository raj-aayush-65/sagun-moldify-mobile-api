import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee, EmployeeType } from './entities/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>
  ) {}

  async create(createEmployeeDto: CreateEmployeeDto, userId: string): Promise<Employee> {
    // Calculate daily rate from monthly salary for permanent employees
    let dailyRate: number | undefined = undefined;
    if (
      createEmployeeDto.employeeType === EmployeeType.PERMANENT &&
      createEmployeeDto.monthlySalary
    ) {
      dailyRate = Number(createEmployeeDto.monthlySalary) / 30;
    }

    const employeeData = {
      ...createEmployeeDto,
      dailyRate,
      createdBy: userId,
    };

    const employee = this.employeeRepository.create(employeeData);
    return this.employeeRepository.save(employee);
  }

  async findAll(
    filters?: {
      employeeType?: EmployeeType;
      isActive?: boolean;
    },
    page = 1,
    limit = 20
  ): Promise<{ data: Employee[]; total: number; page: number; limit: number }> {
    const query = this.employeeRepository.createQueryBuilder('employee');

    if (filters?.employeeType) {
      query.andWhere('employee.employeeType = :employeeType', {
        employeeType: filters.employeeType,
      });
    }

    if (filters?.isActive !== undefined) {
      query.andWhere('employee.isActive = :isActive', {
        isActive: filters.isActive,
      });
    }

    query.orderBy('employee.createdAt', 'DESC');

    const total = await query.getCount();
    const data = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({ where: { id } });
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }
    return employee;
  }

  async findByIds(ids: string[]): Promise<Employee[]> {
    return this.employeeRepository.findByIds(ids);
  }

  async update(id: string, updateEmployeeDto: UpdateEmployeeDto): Promise<Employee> {
    const employee = await this.findOne(id);

    // Recalculate daily rate if monthly salary is updated
    if (
      updateEmployeeDto.monthlySalary !== undefined &&
      employee.employeeType === EmployeeType.PERMANENT
    ) {
      updateEmployeeDto['dailyRate'] = Number(updateEmployeeDto.monthlySalary) / 30;
    }

    Object.assign(employee, updateEmployeeDto);
    return this.employeeRepository.save(employee);
  }

  async remove(id: string): Promise<void> {
    const employee = await this.findOne(id);
    // Soft delete - just set isActive to false
    employee.isActive = false;
    await this.employeeRepository.save(employee);
  }

  async activate(id: string): Promise<Employee> {
    const employee = await this.findOne(id);
    employee.isActive = true;
    return this.employeeRepository.save(employee);
  }

  async getActiveEmployees(): Promise<Employee[]> {
    return this.employeeRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getEmployeesByType(type: EmployeeType): Promise<Employee[]> {
    return this.employeeRepository.find({
      where: { employeeType: type, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getEmployeeCount(): Promise<{
    total: number;
    active: number;
    byType: Record<string, number>;
  }> {
    const total = await this.employeeRepository.count();
    const active = await this.employeeRepository.count({ where: { isActive: true } });

    const byType: Record<string, number> = {};
    for (const type of Object.values(EmployeeType)) {
      byType[type] = await this.employeeRepository.count({
        where: { employeeType: type, isActive: true },
      });
    }

    return { total, active, byType };
  }
}
