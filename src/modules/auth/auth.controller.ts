import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { GoogleVerifyDto } from './dto/google-verify.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { SetPinDto } from './dto/set-pin.dto';
import { VerifyPinDto } from './dto/verify-pin.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('pin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Set transaction PIN',
    description:
      'Sets the 4-digit transaction PIN for the authenticated user. ' +
      'Requires a valid access token (Authorize with your Bearer token first). ' +
      'Fails if a PIN has already been set.',
  })
  @ApiBody({ type: SetPinDto })
  @ApiOkResponse({ description: 'Transaction PIN set successfully.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  setPin(@CurrentUser('sub') userId: string, @Body() dto: SetPinDto) {
    return this.authService.setPin(userId, dto.pin);
  }

  @Post('pin/verify')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify transaction PIN',
    description:
      'Verifies the 4-digit transaction PIN for the authenticated user. ' +
      'Requires a valid access token (Authorize with your Bearer token first). ' +
      'Locks out for 15 minutes after 5 consecutive failed attempts.',
  })
  @ApiBody({ type: VerifyPinDto })
  @ApiOkResponse({ description: 'Transaction PIN verified successfully.' })
  @ApiUnauthorizedResponse({
    description: 'Missing/invalid access token, or incorrect PIN.',
  })
  verifyPin(@CurrentUser('sub') userId: string, @Body() dto: VerifyPinDto) {
    return this.authService.verifyPin(userId, dto.pin);
  }

  /**
   * OPTIONAL step for the SPA Google sign-in — issue a single-use nonce.
   *
   * The frontend calls this, passes the returned `nonce` to Google Identity
   * Services (`initialize({ nonce })`), and Google binds it into the signed ID
   * token. POST /auth/google/verify then enforces that same nonce as single-use,
   * which is what makes a captured ID token non-replayable. Skipping this step
   * is allowed — /auth/google/verify works without a nonce too.
   */
  @Get('google/nonce')
  @Public()
  @ApiOperation({
    summary: 'Issue a single-use nonce for Google sign-in (OPTIONAL)',
    description:
      'Optional replay-protection step for the redirect-free Google sign-in. ' +
      'Returns a short-lived, single-use nonce. If the client wants replay ' +
      'protection it passes this to Google Identity Services as `nonce` so it is ' +
      'embedded in the ID token; POST /auth/google/verify then enforces it. ' +
      'The nonce expires after 10 minutes and is consumed on first successful ' +
      'verification. Clients that skip this step can still call /auth/google/verify.',
  })
  @ApiOkResponse({
    description:
      'Nonce issued — returns { status, message, data: { nonce } }.',
    schema: {
      example: {
        status: true,
        message: 'Google sign-in nonce issued',
        data: { nonce: 'a1b2c3...(64 hex chars)' },
      },
    },
  })
  googleNonce() {
    return this.authService.issueGoogleNonce();
  }

  /**
   * SPA Google sign-in — verify the ID token. No redirect.
   *
   * The frontend runs Google Identity Services, gets a `credential` (ID token),
   * and POSTs it here. The server verifies the token's signature/issuer/
   * audience/expiry with Google and returns the same access + refresh token
   * pair as every other login route. If the token carries a nonce (from the
   * optional GET /auth/google/nonce step) it is enforced as single-use.
   */
  @Post('google/verify')
  @Public()
  @ApiOperation({
    summary: 'Verify a Google ID token and log in (SPA / mobile)',
    description:
      'Redirect-free Google sign-in. Server-side verification of a Google ID ' +
      'token obtained client-side via Google Identity Services. The server ' +
      'validates the token signature/issuer/audience/expiry against Google, ' +
      'links or creates the account, and returns an access + refresh token ' +
      'pair. Nonce is OPTIONAL: if the token carries a nonce from GET ' +
      '/auth/google/nonce it is enforced as single-use (replay protection); ' +
      'otherwise it is skipped. Register the frontend origin under "Authorized ' +
      'JavaScript origins" in the Google console — no redirect URI needed.',
  })
  @ApiBody({ type: GoogleVerifyDto })
  @ApiOkResponse({
    description:
      'Google login successful — returns { status, message, data: { accessToken, refreshToken, user } }.',
  })
  @ApiUnauthorizedResponse({
    description:
      'The Google token was invalid, expired, or unverified — or a supplied ' +
      'nonce was unrecognised, expired, or already used.',
  })
  googleVerify(@Body() dto: GoogleVerifyDto) {
    return this.authService.verifyGoogleToken(dto.idToken);
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
