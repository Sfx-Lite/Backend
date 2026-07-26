import {
  Injectable,
  ConflictException,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { type StringValue } from 'ms';

import { env } from '../../config/env';
import { CacheService } from '../../common/cache/cache.service';
import { sendResponse } from '../../common/utils/response.util';
import { EmailService } from '../email/email.service';
import { buildPasswordResetEmail } from '../email/templates/password-reset-email.template';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { WalletsService } from '../wallets/wallets.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleProfile } from './interfaces/google-profile.interface';

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly googleOAuthClient = new OAuth2Client(env.google.clientId);

  private static readonly GOOGLE_NONCE_TTL_SECONDS = 10 * 60;

  private static readonly PASSWORD_RESET_TTL_MINUTES = 60;

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly wallets: WalletsService,
    private readonly cache: CacheService,
    private readonly email: EmailService,
  ) {}

  /** Hash a reset token so only its digest is ever stored in the database. */
  private static hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private static googleNonceKey(nonce: string): string {
    return `google:nonce:${nonce}`;
  }

  async issueGoogleNonce() {
    const nonce = randomBytes(32).toString('hex');

    await this.cache.set(
      AuthService.googleNonceKey(nonce),
      true,
      AuthService.GOOGLE_NONCE_TTL_SECONDS,
    );

    return sendResponse({ nonce }, 'Google sign-in nonce issued');
  }

  private async provisionDepositAddress(userId: string): Promise<void> {
    try {
      await this.wallets.createForUser(userId);
    } catch (err) {
      this.logger.warn(
        `Deposit address not provisioned for user ${userId}: ${
          (err as Error).message
        }`,
      );
    }
  }

  private async issueTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: env.jwt.accessSecret!,
      expiresIn: env.jwt.accessExpiresIn as StringValue,
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: env.jwt.refreshSecret!,
      expiresIn: env.jwt.refreshExpiresIn as StringValue,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      mobileNumber: user.mobileNumber,
      firstName: user.firstName,
      lastName: user.lastName,
      country: user.country,
      tier: user.tier,
      role: user.role,
    };
  }

  async register(dto: RegisterDto) {
    const existingUsers = await this.users.find({
      where: [
        { email: dto.email },
        { username: dto.username },
        { mobileNumber: dto.mobileNumber },
      ],
      select: ['email', 'username', 'mobileNumber'],
    });

    if (existingUsers.some((u) => u.email === dto.email)) {
      throw new ConflictException('Email already exists');
    }

    if (existingUsers.some((u) => u.username === dto.username)) {
      throw new ConflictException('Username already exists');
    }

    if (existingUsers.some((u) => u.mobileNumber === dto.mobileNumber)) {
      throw new ConflictException('Mobile number already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = this.users.create({
      username: dto.username,
      email: dto.email,
      mobileNumber: dto.mobileNumber,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      country: dto.country,
    });

    await this.users.save(user);

    await this.provisionDepositAddress(user.id);

    const tokens = await this.issueTokens(user);

    return sendResponse(
      {
        ...tokens,
        user: this.toPublicUser(user),
        isPin: Boolean(user.pinHash),
      },
      'Registration successful',
    );
  }

  /**
   * Authenticate a login request and return the User, or throw. Shared by
   * login() and adminLogin().
   *
   * The root-admin bootstrap is confined to the admin login path
   * (`allowRootProvision`): logging in with ROOT_ADMIN_EMAIL creates the account
   * as a super_admin on first use (only if the submitted password matches
   * ROOT_ADMIN_PASSWORD, so only the env-secret holder can provision it), and
   * thereafter ensures that account keeps the super_admin role. The public user
   * login never provisions or elevates — it authenticates against stored
   * credentials only.
   */
  private async authenticate(
    dto: LoginDto,
    options: { allowRootProvision?: boolean } = {},
  ): Promise<User> {
    const allowRootProvision = options.allowRootProvision ?? false;
    const rootEmail = env.admin.rootEmail?.trim().toLowerCase();
    const isRootLogin =
      !!rootEmail && dto.emailOrUsername.trim().toLowerCase() === rootEmail;

    let user = await this.users.findOne({
      where: [
        { email: dto.emailOrUsername },
        { username: dto.emailOrUsername },
      ],
    });

    // First-ever root login: provision the super_admin. The password is
    // verified here against the env secret, never revealing the root email.
    // Only the admin login endpoint may trigger this bootstrap.
    if (allowRootProvision && isRootLogin && !user) {
      if (!env.admin.rootPassword || dto.password !== env.admin.rootPassword) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const passwordHash = await bcrypt.hash(dto.password, 12);

      user = await this.users.save(
        this.users.create({
          email: rootEmail,
          username: env.admin.rootUsername?.trim() || 'root_admin',
          passwordHash,
          role: UserRole.SUPER_ADMIN,
        }),
      );

      await this.provisionDepositAddress(user.id);
      this.logger.log(`Root admin provisioned on first login: ${rootEmail}`);

      if (user.suspendedAt) {
        throw new ForbiddenException('Account suspended');
      }

      return user;
    }

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Keep the root account elevated even if it predates this rule — but only
    // when it re-authenticates through the admin login path.
    if (allowRootProvision && isRootLogin && user.role !== UserRole.SUPER_ADMIN) {
      user.role = UserRole.SUPER_ADMIN;
      user = await this.users.save(user);
    }

    if (user.suspendedAt) {
      throw new ForbiddenException('Account suspended');
    }

    return user;
  }

  private async buildLoginResponse(user: User) {
    const tokens = await this.issueTokens(user);

    return sendResponse(
      {
        ...tokens,
        user: this.toPublicUser(user),
        isPin: Boolean(user.pinHash),
      },
      'Login successful',
    );
  }

  /**
   * Public user login. Authenticates a regular user against stored credentials
   * and refuses admin/super_admin accounts — admins must use the dedicated
   * admin endpoint, so an elevated session can never be minted from the public
   * login surface. This endpoint also never provisions the root admin.
   */
  async login(dto: LoginDto) {
    const user = await this.authenticate(dto);

    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Not allowed',
      );
    }

    return this.buildLoginResponse(user);
  }

  /**
   * Admin dashboard login — the ONLY endpoint that authenticates admins. Same
   * credential flow as login(), but rejects any account that is not an admin or
   * super_admin, and is the sole path that bootstraps the root admin on first
   * use. Keeps the admin surface fully separate from the public user login.
   */
  async adminLogin(dto: LoginDto) {
    const user = await this.authenticate(dto, { allowRootProvision: true });

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'This account is not authorized for admin access',
      );
    }

    return this.buildLoginResponse(user);
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;

    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: env.jwt.refreshSecret!,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.users.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (user.suspendedAt) {
      throw new ForbiddenException('Account suspended');
    }

    const tokens = await this.issueTokens(user);

    return sendResponse(tokens, 'Token refreshed');
  }

  async verifyGoogleToken(idToken: string) {
    let profile: GoogleProfile;
    let nonce: string | undefined;

    try {
      const ticket = await this.googleOAuthClient.verifyIdToken({
        idToken,
        audience: env.google.clientId!,
      });

      const payload = ticket.getPayload();

      if (!payload?.sub || !payload.email) {
        throw new UnauthorizedException(
          'Google token did not contain the required profile information',
        );
      }

      if (payload.email_verified === false) {
        throw new UnauthorizedException('Google email is not verified');
      }

      nonce = payload.nonce;

      profile = {
        googleId: payload.sub,
        email: payload.email,
        firstName: payload.given_name,
        lastName: payload.family_name,
        picture: payload.picture,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }

      this.logger.warn(
        `Google ID token verification failed: ${(err as Error).message}`,
      );

      throw new UnauthorizedException('Invalid or expired Google token');
    }

    if (nonce) {
      const nonceKey = AuthService.googleNonceKey(nonce);

      const issued = await this.cache.get<boolean>(nonceKey);

      if (!issued) {
        throw new UnauthorizedException(
          'Google sign-in nonce is invalid, expired, or already used',
        );
      }

      await this.cache.del(nonceKey);
    }

    return this.googleLogin(profile);
  }

  async googleLogin(profile: GoogleProfile) {
    if (!profile.email || !profile.googleId) {
      throw new UnauthorizedException(
        'Google account did not provide the required profile information',
      );
    }

    const normalizedEmail = profile.email.trim().toLowerCase();

    let isNewUser = false;

    let user = await this.users.findOne({
      where: { googleId: profile.googleId },
    });

    if (!user) {
      user = await this.users.findOne({
        where: { email: normalizedEmail },
      });

      if (user) {
        if (user.googleId && user.googleId !== profile.googleId) {
          throw new ConflictException(
            'This email is already linked to another Google account',
          );
        }

        user.googleId = profile.googleId;

        if (!user.firstName && profile.firstName) {
          user.firstName = profile.firstName;
        }

        if (!user.lastName && profile.lastName) {
          user.lastName = profile.lastName;
        }

        user = await this.users.save(user);
      } else {
        const username = await this.generateUniqueUsername(
          normalizedEmail,
          profile.firstName,
        );

        user = this.users.create({
          username,
          email: normalizedEmail,
          googleId: profile.googleId,
          passwordHash: null,
          firstName: profile.firstName ?? null,
          lastName: profile.lastName ?? null,
        });

        user = await this.users.save(user);

        isNewUser = true;

        await this.provisionDepositAddress(user.id);
      }
    }

    if (user.suspendedAt) {
      throw new ForbiddenException('Account suspended');
    }

    const tokens = await this.issueTokens(user);

    return sendResponse(
      {
        ...tokens,
        user: this.toPublicUser(user),
        isNewUser,
        isPin: Boolean(user.pinHash),
      },
      'Google login successful',
    );
  }

  private async generateUniqueUsername(
    email: string,
    firstName?: string,
  ): Promise<string> {
    const emailName = email.split('@')[0];

    const baseUsername = (firstName || emailName || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 40);

    const safeBase = baseUsername || 'user';

    const existingUser = await this.users.findOne({
      where: { username: safeBase },
    });

    if (!existingUser) {
      return safeBase;
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const suffix = Math.floor(100000 + Math.random() * 900000).toString();

      const candidate = `${safeBase.slice(0, 43)}_${suffix}`;

      const duplicate = await this.users.findOne({
        where: { username: candidate },
      });

      if (!duplicate) {
        return candidate;
      }
    }

    throw new ConflictException('Could not generate a unique username');
  }

  async setPin(userId: string, pin: string) {
    const user = await this.users.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.suspendedAt) {
      throw new ForbiddenException('Account suspended');
    }

    if (user.pinHash) {
      throw new ConflictException('Transaction PIN has already been set');
    }

    user.pinHash = await bcrypt.hash(pin, 12);

    await this.users.save(user);

    return sendResponse(null, 'Transaction PIN set successfully');
  }

  async verifyPin(userId: string, pin: string) {
    const maxAttempts = 5;
    const lockoutDurationMs = 15 * 60 * 1000;

    const user = await this.users.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.suspendedAt) {
      throw new ForbiddenException('Account suspended');
    }

    if (!user.pinHash) {
      throw new ForbiddenException('Transaction PIN has not been set');
    }

    const now = new Date();

    if (user.pinLockedUntil && user.pinLockedUntil.getTime() > now.getTime()) {
      const remainingSeconds = Math.ceil(
        (user.pinLockedUntil.getTime() - now.getTime()) / 1000,
      );

      throw new ForbiddenException(
        `PIN verification is temporarily locked. Try again in ${remainingSeconds} seconds`,
      );
    }

    if (user.pinLockedUntil && user.pinLockedUntil.getTime() <= now.getTime()) {
      user.pinLockedUntil = null;
      user.pinFailedAttempts = 0;
    }

    const pinMatches = await bcrypt.compare(pin, user.pinHash);

    if (!pinMatches) {
      user.pinFailedAttempts = (user.pinFailedAttempts ?? 0) + 1;

      if (user.pinFailedAttempts >= maxAttempts) {
        user.pinLockedUntil = new Date(now.getTime() + lockoutDurationMs);
        user.pinFailedAttempts = 0;

        await this.users.save(user);

        throw new ForbiddenException(
          'Too many incorrect PIN attempts. Try again in 15 minutes',
        );
      }

      const remainingAttempts = maxAttempts - user.pinFailedAttempts;

      await this.users.save(user);

      throw new UnauthorizedException(
        `Invalid PIN. ${remainingAttempts} attempt${
          remainingAttempts === 1 ? '' : 's'
        } remaining`,
      );
    }

    user.pinFailedAttempts = 0;
    user.pinLockedUntil = null;

    await this.users.save(user);

    return sendResponse(
      {
        verified: true,
      },
      'Transaction PIN verified successfully',
    );
  }

  /**
   * Start the forgot-password flow: if an account with this email exists and
   * has a password, generate a single-use token, store only its hash + an
   * expiry on the user row, and email the reset link.
   *
   * The response is intentionally the same whether or not the email exists, so
   * this endpoint cannot be used to enumerate registered accounts.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const neutralMessage =
      'If an account exists for that email, a password reset link has been sent.';

    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.users.findOne({
      where: { email: normalizedEmail },
    });

    // Only email accounts that can actually have a password reset. Google-only
    // accounts (no passwordHash) are skipped, but the response is unchanged.
    if (!user || !user.passwordHash || user.suspendedAt) {
      return sendResponse(null, neutralMessage);
    }

    const rawToken = randomBytes(32).toString('hex');

    user.passwordResetToken = AuthService.hashResetToken(rawToken);
    user.passwordResetExpiresAt = new Date(
      Date.now() + AuthService.PASSWORD_RESET_TTL_MINUTES * 60 * 1000,
    );

    await this.users.save(user);

    const resetUrl = `${env.frontendUrl.replace(/\/$/, '')}/reset_password/${rawToken}`;

    const recipientName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    const template = buildPasswordResetEmail({
      recipientName,
      resetUrl,
      expiresInText: `${AuthService.PASSWORD_RESET_TTL_MINUTES} minutes`,
    });

    try {
      await this.email.send({
        to: user.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    } catch (err) {
      // Don't leak delivery state to the caller, but surface it in logs.
      this.logger.error(
        `Password reset email failed for user ${user.id}: ${
          (err as Error).message
        }`,
      );
    }

    return sendResponse(null, neutralMessage);
  }

  /**
   * Complete the flow: validate the token from the emailed link against the
   * stored hash and expiry, set the new password, and clear the reset token so
   * it cannot be reused. The user can then log in with the new password.
   */
  async resetPassword(token: string, dto: ResetPasswordDto) {
    const tokenHash = AuthService.hashResetToken(token);

    const user = await this.users.findOne({
      where: { passwordResetToken: tokenHash },
    });

    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException(
        'This password reset link is invalid or has expired',
      );
    }

    if (user.suspendedAt) {
      throw new ForbiddenException('Account suspended');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;

    await this.users.save(user);

    return sendResponse(
      null,
      'Password has been reset successfully. You can now log in with your new password.',
    );
  }
}
