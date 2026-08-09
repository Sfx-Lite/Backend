import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleVerifyDto } from './dto/google-verify.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetPinDto } from './dto/set-pin.dto';
import { VerifyPinDto } from './dto/verify-pin.dto';
import { ResetPinDto } from './dto/reset-pin.dto';
import { Set2faDto } from './dto/set-2fa.dto';
import { VerifyLoginOtpDto } from './dto/verify-login-otp.dto';
import { ResendLoginOtpDto } from './dto/resend-login-otp.dto';

/** The public user object returned inside every auth session response. */
const EXAMPLE_AUTH_USER = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  username: 'johndoe',
  email: 'john@example.com',
  mobileNumber: '+2348012345678',
  firstName: 'John',
  lastName: 'Doe',
  country: 'NG',
  tier: 1,
  role: 'user',
  kycStatus: 'unverified',
};

/** A representative access + refresh token pair, for Swagger examples. */
const EXAMPLE_TOKENS = {
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.<access>.<sig>',
  refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.<refresh>.<sig>',
};

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
  @ApiOkResponse({
    description: 'Transaction PIN set successfully.',
    schema: {
      example: {
        status: true,
        message: 'Transaction PIN set successfully',
        data: null,
      },
    },
  })
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
  @ApiOkResponse({
    description: 'Transaction PIN verified successfully.',
    schema: {
      example: {
        status: true,
        message: 'Transaction PIN verified successfully',
        data: { verified: true },
      },
    },
  })
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
    description: 'Nonce issued — returns { status, message, data: { nonce } }.',
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
      'Google login successful. The `user` object includes the current ' +
      '`kycStatus` (unverified / pending / verified / rejected). `isNewUser` ' +
      'is true when the account was created during this sign-in.',
    schema: {
      example: {
        status: true,
        message: 'Google login successful',
        data: {
          ...EXAMPLE_TOKENS,
          user: EXAMPLE_AUTH_USER,
          isNewUser: false,
          isPin: false,
        },
      },
    },
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
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({
    description:
      'Registration successful — returns a token pair plus the new user ' +
      '(a freshly registered account starts with kycStatus "unverified").',
    schema: {
      example: {
        status: true,
        message: 'Registration successful',
        data: {
          ...EXAMPLE_TOKENS,
          user: EXAMPLE_AUTH_USER,
          isPin: false,
        },
      },
    },
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @ApiOperation({
    summary:
      'User login with email OR username + password — issues tokens, or a 2FA challenge',
    description:
      'The login for regular users only. Admin and super_admin accounts are ' +
      'rejected with 403 and must use POST /auth/admin/login — the public login ' +
      'surface can never mint an admin session, nor does it provision the root ' +
      'admin. The issued token carries the role for client-side routing.\n\n' +
      'TWO POSSIBLE OUTCOMES:\n' +
      '1. 2FA OFF — returns the access + refresh token pair plus the user ' +
      '(the example below). The user is logged in.\n' +
      '2. 2FA ON (`twoFactorEnabled`) — NO tokens are returned. Instead a ' +
      'one-time code is emailed and the response is ' +
      '`{ requiresOtp: true, otpToken }`. The client must detect ' +
      '`data.requiresOtp === true`, route to the OTP screen, and complete login ' +
      'via POST /auth/login/otp (or re-send via POST /auth/login/otp/resend). ' +
      'The `otpToken` is a short-lived (10 min) handle for that pending login.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description:
      'Either a completed login OR a 2FA challenge.\n\n' +
      '• 2FA off (shown below): the token pair plus the `user` object, which ' +
      'includes the current `kycStatus` (unverified / pending / verified / ' +
      'rejected) so the client can route the user to KYC when needed. `isPin` ' +
      'indicates whether a transaction PIN has been set.\n\n' +
      '• 2FA on: `{ status: true, message: "A verification code has been sent ' +
      'to your email", data: { requiresOtp: true, otpToken: "<jwt>" } }` — no ' +
      'tokens until the OTP is verified at POST /auth/login/otp.',
    schema: {
      example: {
        status: true,
        message: 'Login successful',
        data: {
          ...EXAMPLE_TOKENS,
          user: EXAMPLE_AUTH_USER,
          isPin: false,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  @ApiForbiddenResponse({
    description:
      'The credentials belong to an admin account — sign in via POST /auth/admin/login instead.',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('admin/login')
  @Public()
  @ApiOperation({
    summary: 'Admin dashboard login (admin / super_admin only)',
    description:
      'The dedicated, separate sign-in for the admin dashboard and the ONLY ' +
      'endpoint that authenticates admins. Same credential format as ' +
      '/auth/login, but rejects any account that is not an admin or super_admin ' +
      'with 403. The root admin (ROOT_ADMIN_EMAIL) is provisioned exclusively ' +
      'here on first use (password must match ROOT_ADMIN_PASSWORD).\n\n' +
      'TWO POSSIBLE OUTCOMES (same as /auth/login):\n' +
      '1. 2FA OFF — returns the token pair plus the admin user (the example ' +
      'below).\n' +
      '2. 2FA ON (`twoFactorEnabled`) — NO tokens. A one-time code is emailed ' +
      'and the response is `{ requiresOtp: true, otpToken }`. The dashboard must ' +
      'detect `data.requiresOtp === true`, show the OTP screen, and finish login ' +
      'via POST /auth/login/otp (resend via POST /auth/login/otp/resend).',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description:
      'Either a completed admin login OR a 2FA challenge.\n\n' +
      '• 2FA off (shown below): a token pair plus the admin user (role admin or ' +
      'super_admin).\n\n' +
      '• 2FA on: `{ status: true, message: "A verification code has been sent ' +
      'to your email", data: { requiresOtp: true, otpToken: "<jwt>" } }` — no ' +
      'tokens until the OTP is verified at POST /auth/login/otp.',
    schema: {
      example: {
        status: true,
        message: 'Login successful',
        data: {
          ...EXAMPLE_TOKENS,
          user: {
            ...EXAMPLE_AUTH_USER,
            username: 'root_admin',
            email: 'admin@sfxlite.com',
            role: 'super_admin',
            kycStatus: 'unverified',
          },
          isPin: false,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  @ApiForbiddenResponse({
    description: 'The account is valid but not authorized for admin access.',
  })
  adminLogin(@Body() dto: LoginDto) {
    return this.authService.adminLogin(dto);
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Issue a fresh token pair from a refresh token' })
  @ApiBody({ type: RefreshDto })
  @ApiOkResponse({
    description: 'A fresh access + refresh token pair.',
    schema: {
      example: {
        status: true,
        message: 'Token refreshed',
        data: EXAMPLE_TOKENS,
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'The refresh token is invalid or has expired.',
  })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('forgot_password')
  @Public()
  @ApiOperation({
    summary: 'Request a password reset link',
    description:
      'Sends a password reset link to the account email if it exists. The ' +
      'response is identical whether or not the email is registered, to avoid ' +
      'account enumeration.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOkResponse({
    description:
      'A reset link has been sent if the email belongs to an eligible account. ' +
      'The response is identical whether or not the email is registered.',
    schema: {
      example: {
        status: true,
        message:
          'If an account exists for that email, a password reset link has been sent.',
        data: null,
      },
    },
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset_password/:token')
  @Public()
  @ApiOperation({
    summary: 'Reset a password using the emailed token',
    description:
      'Consumes the single-use token from the emailed reset link (URL param) ' +
      'and sets the new password. The link expires after 60 minutes.',
  })
  @ApiParam({
    name: 'token',
    required: true,
    description: 'The password reset token from the emailed link.',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({
    description: 'Password has been reset successfully.',
    schema: {
      example: {
        status: true,
        message:
          'Password has been reset successfully. You can now log in with your new password.',
        data: null,
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'The reset token is invalid or has expired.',
  })
  resetPassword(@Param('token') token: string, @Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(token, dto);
  }
  @Post('pin/reset')
@ApiBearerAuth()
@ApiOperation({
  summary: 'Reset transaction PIN',
  description:
    'Allows an authenticated user to change their transaction PIN by providing their current PIN and a new 4-digit PIN.',
})
@ApiBody({ type: ResetPinDto })
@ApiOkResponse({
  description: 'Transaction PIN reset successfully.',
})
@ApiUnauthorizedResponse({
  description: 'Missing access token or incorrect current PIN.',
})
resetPin(
  @CurrentUser('sub') userId: string,
  @Body() dto: ResetPinDto,
) {
  return this.authService.resetPin(userId, dto.oldPin, dto.newPin);
}
@Post('2fa')
@ApiBearerAuth()
@ApiOperation({
  summary: 'Enable or disable email-OTP 2FA',
  description:
    'Allows an authenticated user to switch email-OTP two-factor authentication ' +
    'on or off. When enabled, a one-time code is emailed on every login and must ' +
    'be entered at POST /auth/login/otp to complete sign-in.',
})
@ApiBody({ type: Set2faDto })
@ApiOkResponse({
  description: 'Two-factor authentication setting updated successfully.',
  schema: {
    example: {
      status: true,
      message: 'Two-factor authentication enabled successfully',
      data: { twoFactorEnabled: true },
    },
  },
})
set2fa(
  @CurrentUser('sub') userId: string,
  @Body() dto: Set2faDto,
) {
  return this.authService.set2fa(userId, dto.enabled);
}
@Post('login/otp')
@Public()
@ApiOperation({
  summary: 'Complete login with the emailed OTP (2FA)',
  description:
    'Second step of a 2FA login. Submit the otpToken returned by /auth/login ' +
    '(or /auth/admin/login) together with the 6-digit code emailed to the ' +
    'account. On success, returns the normal access + refresh token pair.',
})
@ApiBody({ type: VerifyLoginOtpDto })
@ApiOkResponse({
  description: 'Login completed successfully.',
  schema: {
    example: {
      status: true,
      message: 'Login successful',
      data: {
        ...EXAMPLE_TOKENS,
        user: EXAMPLE_AUTH_USER,
        isPin: false,
      },
    },
  },
})
@ApiUnauthorizedResponse({
  description: 'Invalid or expired OTP session, or incorrect code.',
})
verifyLoginOtp(@Body() dto: VerifyLoginOtpDto) {
  return this.authService.verifyLoginOtp(dto);
}
@Post('login/otp/resend')
@Public()
@ApiOperation({
  summary: 'Resend the login OTP (2FA)',
  description:
    'Re-sends a fresh verification code to the account email for a pending 2FA ' +
    'login. Submit the otpToken from /auth/login or /auth/admin/login — the ' +
    'password is not resubmitted. A new otpToken is returned and the previous ' +
    'code is invalidated. Limited to one request every 30 seconds.',
})
@ApiBody({ type: ResendLoginOtpDto })
@ApiOkResponse({
  description: 'A new verification code has been sent.',
  schema: {
    example: {
      status: true,
      message: 'A new verification code has been sent to your email',
      data: {
        requiresOtp: true,
        otpToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.<otp>.<sig>',
      },
    },
  },
})
@ApiUnauthorizedResponse({
  description: 'Invalid or expired OTP session.',
})
resendLoginOtp(@Body() dto: ResendLoginOtpDto) {
  return this.authService.resendLoginOtp(dto);
}
}

