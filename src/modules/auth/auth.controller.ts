import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('signup')
  @ApiExcludeEndpoint() // Hidden - use only for initial setup
  @ApiOperation({
    summary: '[HIDDEN] Initial Super Admin setup - only works when no admin exists',
  })
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
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
    return this.authService.refreshToken(req.user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user' })
  async me(@Request() req: any) {
    const { passwordHash: _passwordHash, ...user } = req.user;
    return user;
  }
}
