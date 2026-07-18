import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { CheckUsernameDto } from './dto/check-username.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GoogleProfile } from './interfaces/google-profile.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Get('google')
  @Public()
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Start Google OAuth login' })
  googleAuth() {
    return;
  }

  @Get('google/callback')
  @Public()
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  async googleAuthCallback(@Req() req: Request) {
    return this.authService.googleLogin(req.user as GoogleProfile);
  }

  @Get('username-available')
  @Public()
  @ApiOperation({
    summary: 'Check if a username is still available',
    description:
      'Read-only signup helper for live "username taken" feedback. Returns ' +
      '`{ username, available }`.',
  })
  checkUsername(@Query() dto: CheckUsernameDto) {
    return this.authService.checkUsername(dto.username);
  }

  @Post('register')
  @Public()
  @ApiOperation({
    summary: 'Register a new user and issue an access + refresh token pair',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @ApiOperation({
    summary:
      'Log in with email OR username + password, and issue an access + refresh token pair',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Issue a fresh token pair from a refresh token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }
}