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

    // Determine role and permissions
    let role = signupDto.role || UserRole.EMPLOYEE;
    let isSuperAdmin = false;

    // Check if trying to create SUPER_ADMIN
    if (role === UserRole.SUPER_ADMIN) {
      // Allow only in local development environment
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (!isLocalEnv) {
        throw new ConflictException("Cannot create SUPER_ADMIN role");
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
            "Not authorized to create SUPER_USER",
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
