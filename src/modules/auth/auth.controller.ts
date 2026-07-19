import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { GoogleVerifyDto } from './dto/google-verify.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { SetPinDto } from './dto/set-pin.dto';
import { VerifyPinDto } from './dto/verify-pin.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GoogleProfile } from './interfaces/google-profile.interface';

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
   * Step 1 of the Google OAuth2 authorization-code flow.
   *
   * This is a BROWSER endpoint, not a JSON/API call — the GoogleAuthGuard
   * (passport-google-oauth20) intercepts the request and issues a 302 redirect
   * to Google's consent screen, so the handler body never runs. Because it ends
   * in a redirect, it can't be exercised from Swagger's "Try it out"; open it in
   * a browser instead (or link the button to it from the frontend).
   */
  @Get('google')
  @Public()
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Start Google OAuth login (browser redirect)',
    description:
      "Redirects the browser to Google's consent screen. This is the first leg " +
      'of the standard OAuth2 authorization-code flow; there is no request body ' +
      'and no JSON response. After the user consents, Google redirects back to ' +
      'GET /auth/google/callback. Not callable from Swagger — open in a browser.',
  })
  @ApiResponse({
    status: 302,
    description: "Redirect to Google's OAuth consent screen.",
  })
  googleAuth() {
    return;
  }

  /**
   * Step 2 of the Google OAuth2 authorization-code flow — the callback GOOGLE
   * redirects back to (configured as GOOGLE_CALLBACK_URL). It is NOT waiting on
   * any third party other than Google itself: Google appends `?code=...&state=...`,
   * the GoogleAuthGuard exchanges that code for the user's profile (via
   * GoogleStrategy.validate, which populates req.user), and we then mint our own
   * access + refresh tokens. The `code`/`state` params are supplied by Google, so
   * this endpoint also can't be driven manually from Swagger's "Try it out".
   */
  @Get('google/callback')
  @Public()
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Google OAuth callback (browser redirect target)',
    description:
      'The URL Google redirects back to after consent. Passport exchanges the ' +
      '`code` query param for the Google profile, then the app issues its own ' +
      'access + refresh token pair plus the public user object. The `code` and ' +
      '`state` params are provided by Google, so this is not callable directly ' +
      'from Swagger.',
  })
  @ApiQuery({
    name: 'code',
    required: false,
    description: 'Authorization code returned by Google (supplied automatically).',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    description: 'Opaque CSRF/state value round-tripped through Google.',
  })
  @ApiOkResponse({
    description:
      'Google login successful — returns { status, message, data: { accessToken, refreshToken, user } }.',
  })
  @ApiUnauthorizedResponse({
    description: 'Google did not return the required profile information.',
  })
  async googleAuthCallback(@Req() req: Request) {
    return this.authService.googleLogin(req.user as GoogleProfile);
  }

  /**
   * Step 1 of the SPA/mobile Google sign-in — issue a single-use nonce.
   *
   * The frontend calls this, passes the returned `nonce` to Google Identity
   * Services (`initialize({ nonce })`), and Google binds it into the signed ID
   * token. Step 2 (/auth/google/verify) then requires that same nonce, which is
   * what makes a captured ID token non-replayable.
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
   * Step 2 of the SPA/mobile Google sign-in — verify the ID token. No redirect.
   *
   * The frontend runs Google Identity Services (initialized with the nonce from
   * GET /auth/google/nonce), gets a `credential` (ID token), and POSTs it here.
   * The server verifies the token's signature/issuer/audience/expiry with
   * Google, checks the embedded nonce is one we issued and unused, then returns
   * the same access + refresh token pair as every other login route.
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
