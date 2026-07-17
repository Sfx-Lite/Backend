import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/**
 * AuthController — STRUCTURE REFERENCE ONLY (Squad A)
 * ──────────────────────────────────────────────────
 * Shows how routes are declared. Base path 'auth' + global prefix/version
 * means these resolve to /api/v1/auth/*. Each method is one route and does
 * nothing but validate input (via the DTO) and hand off to the service.
 *
 * @Public() marks a route as reachable without a JWT once the auth guard
 * is switched on globally.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /api/v1/auth/register
  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register a new user (stub)' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // POST /api/v1/auth/login
  @Post('login')
  @Public()
  @ApiOperation({
    summary: 'Exchange credentials for access + refresh tokens (stub)',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // POST /api/v1/auth/refresh
  @Post('refresh')
  @Public()
  @ApiOperation({
    summary: 'Issue a new access token from a refresh token (stub)',
  })
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }
}
