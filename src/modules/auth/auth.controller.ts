import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

/**
 * AuthController — Squad A
 * ────────────────────────
 * Base path 'auth' + global prefix/version means these resolve to
 * /api/v1/auth/*. Each method is one route and does nothing but validate input
 * (via the DTO) and hand off to the service; the global interceptor wraps the
 * envelope.
 *
 * @Public() marks a route as reachable without a JWT once the auth guard is
 * switched on globally.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /api/v1/auth/register
  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register a new user' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // POST /api/v1/auth/login
  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Exchange credentials for access + refresh tokens' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // POST /api/v1/auth/refresh
  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Issue a fresh token pair from a refresh token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }
}
