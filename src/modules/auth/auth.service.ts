import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { User } from "../users/entities/user.entity";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";
import { UserRole } from "../../common/enums/user-role.enum";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({ where: { email } });

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      return user;
    }

    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Account is disabled");
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: "7d" }),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
      },
    };
  }

  async signup(signupDto: SignupDto, creatorId?: string) {
    const existingUser = await this.usersRepository.findOne({
      where: { email: signupDto.email },
    });

    if (existingUser) {
      throw new ConflictException("Email already exists");
    }

    // Determine role and permissions based on environment
    let role = signupDto.role || UserRole.EMPLOYEE;
    let isSuperAdmin = false;

    // Check the current environment
    const nodeEnv = process.env.NODE_ENV || "development";
    const isProduction = nodeEnv === "production";
    const isBeta = nodeEnv === "beta";
    const isDevelopment = nodeEnv === "development";

    // Check if trying to create SUPER_ADMIN
    if (role === UserRole.SUPER_ADMIN) {
      // Allow in development and beta, block in production
      if (isProduction) {
        throw new ConflictException(
          "Cannot create SUPER_ADMIN in production environment. Contact system administrator.",
        );
      }

      // In beta, warn but allow for initial setup
      if (isBeta) {
        console.warn(
          "⚠️ Creating SUPER_ADMIN in Beta environment - this should only be used for initial setup",
        );
      }

      // In development, always allow
      if (isDevelopment) {
        console.warn("⚠️ Creating SUPER_ADMIN in Development environment");
      }

      isSuperAdmin = true;
    }

    // If there's a creator, check their permissions
    if (creatorId) {
      const creator = await this.usersRepository.findOne({
        where: { id: creatorId },
      });

      if (creator) {
        // Only Super Admin can create Super User
        if (role === UserRole.SUPER_USER && !creator.isSuperAdmin) {
          throw new UnauthorizedException(
            "Not authorized to create SUPER_USER role",
          );
        }

        // Check if creator can create the requested role
        if (!this.canCreatorCreateRole(creator.role, role)) {
          throw new UnauthorizedException(
            `Not authorized to create ${role} role`,
          );
        }
      }
    }

    const passwordHash = await bcrypt.hash(signupDto.password, 10);

    const user = this.usersRepository.create({
      email: signupDto.email,
      passwordHash,
      firstName: signupDto.firstName,
      lastName: signupDto.lastName,
      phone: signupDto.phone,
      role,
      isSuperAdmin,
      createdBy: creatorId,
    });

    await this.usersRepository.save(user);

    const { passwordHash: _, ...result } = user;

    return {
      message: "User created successfully",
      user: result,
    };
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

  async refreshToken(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: "7d" }),
    };
  }
}
