import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RsaKeyService } from './rsa.service';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly rsaKeyService: RsaKeyService
  ) {}

  @Get('public-key')
  @ApiOperation({ summary: 'Get public key for password encryption' })
  getPublicKey() {
    return {
      publicKey: this.rsaKeyService.getPublicKey(),
    };
  }

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  async login(@Body() loginDto: LoginDto) {
    this.logger.log(`Login attempt for email: ${loginDto.email}`);
    const result = await this.authService.login(loginDto);
    this.logger.log(`Login successful for email: ${loginDto.email}`);
    return ApiResponseDto.success('Login successful', result);
  }

  @Post('signup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiExcludeEndpoint() // Hidden - disabled for public use
  @ApiOperation({
    summary: '[DISABLED] Signup is disabled. Contact your administrator for access.',
  })
  async signup(@Body() _signupDto: SignupDto, @Request() _req: any) {
    // Signup is disabled - users can only be created by Super Admins
    throw new ForbiddenException('Signup is disabled. Contact your administrator for access.');
  }

  /**
   * Admin Seed Endpoint - Creates first Super Admin
   * Only works when no users exist in the system
   * Use this to bootstrap the first Super Admin on Beta/Production
   */
  @Post('admin-seed')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // Hidden from Swagger
  @ApiOperation({
    summary: '[HIDDEN] Bootstrap Super Admin - only works when no users exist',
    description:
      'Use this endpoint to create the first Super Admin. Requires SEED_TOKEN from environment.',
  })
  async adminSeed(
    @Body()
    body: {
      email: string;
      password: string;
      firstName: string;
      seedToken: string;
    }
  ) {
    return this.authService.adminSeed(body);
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Request() req: any) {
    const result = await this.authService.refreshToken(req.user);
    return ApiResponseDto.success('Token refreshed successfully', result);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user' })
  async me(@Request() req: any) {
    const { passwordHash: _passwordHash, ...user } = req.user;
    return ApiResponseDto.success('User fetched successfully', user);
  }
}
