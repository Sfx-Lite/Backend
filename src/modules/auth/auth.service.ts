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
import { randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { type StringValue } from 'ms';

import { env } from '../../config/env';
import { CacheService } from '../../common/cache/cache.service';
import { sendResponse } from '../../common/utils/response.util';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { WalletsService } from '../wallets/wallets.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
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

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly wallets: WalletsService,
    private readonly cache: CacheService,
  ) {}

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
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.users.findOne({
      where: [{ email: dto.email }, { username: dto.username }],
    });

    if (existingUser) {
      throw new ConflictException('Email or username already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = this.users.create({
      username: dto.username,
      email: dto.email,
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
      },
      'Registration successful',
    );
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOne({
      where: [
        { email: dto.emailOrUsername },
        { username: dto.emailOrUsername },
      ],
    });

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

    if (user.suspendedAt) {
      throw new ForbiddenException('Account suspended');
    }

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
}
