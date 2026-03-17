import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { User } from "./entities/user.entity";
import { UserRole } from "../../common/enums/user-role.enum";

interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  role: UserRole;
}

interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: UserRole;
  isActive?: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      select: [
        "id",
        "email",
        "firstName",
        "lastName",
        "phone",
        "role",
        "isActive",
        "isSuperAdmin",
        "createdAt",
      ],
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
    });
  }

  /**
   * Create a new user (used by Super Admin/Super User)
   */
  async create(createUserDto: CreateUserDto, creatorId: string): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException("Email already exists");
    }

    // Get creator to check permissions
    const creator = await this.usersRepository.findOne({
      where: { id: creatorId },
    });

    if (!creator) {
      throw new UnauthorizedException("Creator not found");
    }

    // Check if creator can create this role
    const targetRole = createUserDto.role;

    if (targetRole === UserRole.SUPER_ADMIN) {
      throw new ConflictException(
        "Cannot create SUPER_ADMIN through this endpoint",
      );
    }

    // Only Super Admin can create Super User
    if (targetRole === UserRole.SUPER_USER && !creator.isSuperAdmin) {
      throw new UnauthorizedException("Not authorized to create SUPER_USER");
    }

    // Check role hierarchy
    if (!this.canCreatorCreateRole(creator.role, targetRole)) {
      throw new UnauthorizedException(
        `Not authorized to create ${targetRole} role`,
      );
    }

    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    const user = this.usersRepository.create({
      email: createUserDto.email,
      passwordHash,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      phone: createUserDto.phone,
      role: targetRole,
      isSuperAdmin: false,
      createdBy: creatorId,
    });

    await this.usersRepository.save(user);

    const { passwordHash: _, ...result } = user;
    return result as User;
  }

  /**
   * Update an existing user
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Cannot modify Super Admin
    if (user.isSuperAdmin) {
      throw new UnauthorizedException("Cannot modify Super Admin");
    }

    // Update allowed fields
    if (updateUserDto.firstName) {
      user.firstName = updateUserDto.firstName;
    }
    if (updateUserDto.lastName !== undefined) {
      user.lastName = updateUserDto.lastName;
    }
    if (updateUserDto.phone !== undefined) {
      user.phone = updateUserDto.phone;
    }
    if (updateUserDto.role) {
      user.role = updateUserDto.role;
    }
    if (updateUserDto.isActive !== undefined) {
      user.isActive = updateUserDto.isActive;
    }

    await this.usersRepository.save(user);

    const { passwordHash: _, ...result } = user;
    return result as User;
  }

  /**
   * Deactivate a user (soft delete)
   */
  async deactivate(id: string): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Cannot deactivate Super Admin
    if (user.isSuperAdmin) {
      throw new UnauthorizedException("Cannot deactivate Super Admin");
    }

    user.isActive = false;
    await this.usersRepository.save(user);

    return { message: "User deactivated successfully" };
  }

  /**
   * Check if a creator can create users with a specific role
   */
  private canCreatorCreateRole(
    creatorRole: UserRole,
    targetRole: UserRole,
  ): boolean {
    const roleHierarchy: Record<UserRole, UserRole[]> = {
      [UserRole.SUPER_ADMIN]: [
        UserRole.SUPER_USER,
        UserRole.HIGHER_OPS,
        UserRole.EMPLOYEE,
      ],
      [UserRole.SUPER_USER]: [UserRole.HIGHER_OPS, UserRole.EMPLOYEE],
      [UserRole.HIGHER_OPS]: [UserRole.EMPLOYEE],
      [UserRole.EMPLOYEE]: [],
    };

    return roleHierarchy[creatorRole]?.includes(targetRole) ?? false;
  }
}
