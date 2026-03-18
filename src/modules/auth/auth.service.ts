import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { UserRole } from '../../common/enums/user-role.enum';
import { RsaKeyService } from './rsa.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private rsaKeyService: RsaKeyService
  ) {}

  /**
   * Decrypt password if encrypted, otherwise use as-is
   * The app encrypts passwords using RSA-OAEP with the public key
   */
  private decryptPassword(password: string): string {
    // Check if it looks like encrypted JSON format
    if (password.startsWith('{') && password.includes('encryptedData')) {
      try {
        const parsed = JSON.parse(password);
        if (parsed.encryptedData && parsed.salt) {
          // Decrypt using RSA private key
          const decrypted = this.rsaKeyService.decrypt(parsed.encryptedData);
          // Combine with salt to get original password
          return decrypted + parsed.salt;
        }
      } catch (error) {
        this.logger.warn(`Failed to decrypt password: ${error.message}`);
      }
    }
    // Plain password - use as-is
    return password;
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({ where: { email } });

    // Decrypt password if encrypted
    const decryptedPassword = this.decryptPassword(password);

    if (user && (await bcrypt.compare(decryptedPassword, user.passwordHash))) {
      return user;
    }

    return null;
  }

  async login(loginDto: LoginDto) {
    this.logger.log(`Login attempt for email: ${loginDto.email}`);

    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      this.logger.warn(`Login failed for email: ${loginDto.email} - Invalid credentials`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      this.logger.warn(`Login failed for email: ${loginDto.email} - Account is disabled`);
      throw new UnauthorizedException('Account is disabled');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
    };

    this.logger.log(`Login successful for email: ${loginDto.email}`);

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
        isActive: user.isActive,
      },
    };
  }

  async signup(signupDto: SignupDto, creatorId?: string) {
    const existingUser = await this.usersRepository.findOne({
      where: { email: signupDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Determine role and permissions based on environment
    const role = signupDto.role || UserRole.EMPLOYEE;
    let isSuperAdmin = false;

    // Check the current environment
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';
    const isBeta = nodeEnv === 'beta';
    const isDevelopment = nodeEnv === 'development';

    // Check if trying to create SUPER_ADMIN
    if (role === UserRole.SUPER_ADMIN) {
      // Allow in development and beta, block in production
      if (isProduction) {
        throw new ConflictException(
          'Cannot create SUPER_ADMIN in production environment. Contact system administrator.'
        );
      }

      // In beta, warn but allow for initial setup
      if (isBeta) {
        console.warn(
          '⚠️ Creating SUPER_ADMIN in Beta environment - this should only be used for initial setup'
        );
      }

      // In development, always allow
      if (isDevelopment) {
        console.warn('⚠️ Creating SUPER_ADMIN in Development environment');
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
          throw new UnauthorizedException('Not authorized to create SUPER_USER role');
        }

        // Check if creator can create the requested role
        if (!this.canCreatorCreateRole(creator.role, role)) {
          throw new UnauthorizedException(`Not authorized to create ${role} role`);
        }
      }
    }

    // Decrypt password if encrypted (for backwards compatibility)
    const decryptedPassword = this.decryptPassword(signupDto.password);

    const passwordHash = await bcrypt.hash(decryptedPassword, 10);

    const user = this.usersRepository.create({
      email: signupDto.email,
      passwordHash,
      firstName: signupDto.firstName,
      lastName: signupDto.lastName,
      phone: signupDto.phone,
      role,
      isSuperAdmin,
      isActive: true,
      createdBy: creatorId,
    });

    await this.usersRepository.save(user);

    const { passwordHash: _passwordHash, ...result } = user;

    return {
      message: 'User created successfully',
      user: result,
    };
  }

  /**
   * Check if a creator can create users with a specific role
   */
  private canCreatorCreateRole(creatorRole: UserRole, targetRole: UserRole): boolean {
    const roleHierarchy: Record<UserRole, UserRole[]> = {
      [UserRole.SUPER_ADMIN]: [UserRole.SUPER_USER, UserRole.HIGHER_OPS, UserRole.EMPLOYEE],
      [UserRole.SUPER_USER]: [UserRole.HIGHER_OPS, UserRole.EMPLOYEE],
      [UserRole.HIGHER_OPS]: [UserRole.EMPLOYEE],
      [UserRole.EMPLOYEE]: [],
    };

    return roleHierarchy[creatorRole]?.includes(targetRole) ?? false;
  }

  /**
   * Admin Seed - Create first Super Admin
   * Only works when no users exist in the system
   */
  async adminSeed(body: { email: string; password: string; firstName: string; seedToken: string }) {
    // Validate seed token from environment
    const expectedToken = process.env.SEED_TOKEN;

    if (!expectedToken) {
      throw new ForbiddenException('Seed token not configured on server');
    }

    if (body.seedToken !== expectedToken) {
      throw new UnauthorizedException('Invalid seed token');
    }

    // Check if any users exist
    const userCount = await this.usersRepository.count();

    if (userCount > 0) {
      throw new ConflictException(
        'Cannot seed - users already exist. Use regular user creation instead.'
      );
    }

    // Create Super Admin
    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = this.usersRepository.create({
      email: body.email,
      passwordHash,
      firstName: body.firstName,
      role: UserRole.SUPER_ADMIN,
      isSuperAdmin: true,
      isActive: true,
    });

    await this.usersRepository.save(user);

    // Generate tokens
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
    };

    return {
      message: 'Super Admin created successfully',
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
      },
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
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }
}
