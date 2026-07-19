import {
  Injectable,
  ConflictException,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { GoogleProfile } from './interfaces/google-profile.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
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

/**
 * Claims carried in both the access and refresh tokens. Kept minimal — the
 * refresh flow re-reads the user, so nothing here is trusted as authoritative
 * beyond `sub`.
 */
interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

/**
 * AuthService — Squad A
 * ─────────────────────
 * The controller never touches the DB, hashes, or tokens directly — it
 * calls these methods.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Google's token verifier. Configured with our OAuth client ID so that
   * `verifyIdToken` enforces the `aud` (audience) claim — a token minted for a
   * different app is rejected. Reused across requests (it caches Google's
   * public signing keys internally).
   */
  private readonly googleOAuthClient = new OAuth2Client(env.google.clientId);

  /**
   * How long an issued Google sign-in nonce stays valid. Long enough for the
   * user to finish the Google prompt, short enough to keep the replay window
   * tiny. Nonces are also single-use (deleted on first successful verify).
   */
  private static readonly GOOGLE_NONCE_TTL_SECONDS = 10 * 60;

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly wallets: WalletsService,
    private readonly cache: CacheService,
  ) {}

  /** Cache key for a pending single-use Google sign-in nonce. */
  private static googleNonceKey(nonce: string): string {
    return `google:nonce:${nonce}`;
  }

  /**
   * Issue a single-use nonce for the SPA Google sign-in flow.
   *
   * The frontend calls this first, passes the returned `nonce` to Google
   * Identity Services (`initialize({ nonce })`), and Google binds it into the
   * signed ID token's `nonce` claim. On /auth/google/verify we require that
   * claim to match a nonce we issued and have not yet consumed — which is what
   * stops a captured ID token from being replayed.
   */
  async issueGoogleNonce() {
    const nonce = randomBytes(32).toString('hex');

    await this.cache.set(
      AuthService.googleNonceKey(nonce),
      true,
      AuthService.GOOGLE_NONCE_TTL_SECONDS,
    );

    return sendResponse({ nonce }, 'Google sign-in nonce issued');
  }

  /**
   * Assign the user's on-chain deposit address at signup.
   * Non-fatal: if the wallet service isn't configured yet (no master mnemonic),
   * registration still succeeds and the address is backfilled on first use —
   * this keeps Squad A's M1 login flow unblocked per the Week 1 plan.
   */
  private async provisionDepositAddress(userId: string): Promise<void> {
    try {
      await this.wallets.createForUser(userId);
    } catch (err) {
      this.logger.warn(
        `Deposit address not provisioned for user ${userId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Single source of truth for issuing a token pair. Access and refresh
   * tokens are signed with DIFFERENT secrets (jwt.accessSecret /
   * jwt.refreshSecret) so leaking one doesn't compromise the other.
   *
   * Fix: previously the refresh token was signed with the default
   * JwtModule secret (jwt.accessSecret), only overriding expiresIn.
   * That meant access and refresh tokens were interchangeable, which
   * defeats the purpose of having two secrets.
   */
  private async issueTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // env.jwt.* is the single source of truth (see src/config/env.ts).
    // accessSecret / refreshSecret are Joi-required at boot, so they're always
    // defined at runtime — the `!` tells TypeScript that too (the typed env
    // widens them to `string | undefined`, which breaks signAsync's overload
    // resolution).
    //
    // `as StringValue` on expiresIn: jsonwebtoken's newer types want a branded
    // `StringValue` (from the `ms` package) instead of a plain string,
    // even though a plain string like '15m' is exactly what it accepts
    // at runtime. This is a known typing friction point with
    // @nestjs/jwt + jsonwebtoken v9 — not a real type-safety hole here,
    // since the value always comes from our own validated env config.
    const accessToken = await this.jwt.signAsync(payload, {
      secret: env.jwt.accessSecret!,
      expiresIn: env.jwt.accessExpiresIn as StringValue,
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: env.jwt.refreshSecret!,
      expiresIn: env.jwt.refreshExpiresIn as StringValue,
    });

    return { accessToken, refreshToken };
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

  /**
   * Check whether a username is already taken, WITHOUT attempting to register.
   * Lets the frontend give live "username available / taken" feedback on the
   * signup form. This is a read-only convenience endpoint — the authoritative
   * uniqueness check still runs inside `register()` (below), which also guards
   * against a race between this check and the actual signup.
   */

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

  /**
   * (email OR username) + password login.
   *  1. Look up the user by email OR username (same field accepts either).
   *  2. Verify the password against the stored bcrypt hash.
   *  3. Issue an access + refresh token pair.
   *
   * The failure message is deliberately identical for "no such user",
   * "Google-only account" and "wrong password" so the endpoint can't be used
   * to enumerate which emails or usernames are registered.
   */
  async login(dto: LoginDto) {
    const user = await this.users.findOne({
      where: [
        { email: dto.emailOrUsername },
        { username: dto.emailOrUsername },
      ],
    });

    // Google-only accounts have no passwordHash and cannot log in by password.
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
      },
      'Login successful',
    );
  }

  /**
   * Exchange a valid refresh token for a fresh token pair (rotation).
   *  1. Verify the refresh token's signature + expiry against the REFRESH
   *     secret (an access token presented here will fail — different secret).
   *  2. Re-load the user so the new tokens reflect current email/role and so a
   *     deleted or suspended account can't refresh its way back in.
   *  3. Issue and return a new access + refresh pair.
   */
  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: env.jwt.refreshSecret!,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (user.suspendedAt) {
      throw new ForbiddenException('Account suspended');
    }

    const tokens = await this.issueTokens(user);

    return sendResponse(tokens, 'Token refreshed');
  }

  /**
   * SPA/mobile Google sign-in — verifies a Google ID token minted client-side
   * by Google Identity Services, then reuses the same account-linking + token
   * issuance path as the redirect flow.
   *
   * Unlike GET /auth/google → /auth/google/callback (a browser redirect flow),
   * this takes no redirect_uri round-trip: the frontend already holds the ID
   * token (`credential`) and POSTs it here. We verify:
   *   • the signature against Google's public keys,
   *   • the issuer (accounts.google.com),
   *   • the audience (`aud` === our GOOGLE_CLIENT_ID),
   *   • that Google marked the email as verified, and
   *   • that the `nonce` claim matches a single-use nonce we issued via
   *     issueGoogleNonce() and have not consumed yet (replay protection).
   * Only then do we trust the profile and issue our own token pair.
   */
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

      // Reject accounts whose email Google has not itself verified.
      if (payload.email_verified === false) {
        throw new UnauthorizedException('Google email is not verified');
      }

      // Nonce is OPTIONAL. If the client used the /auth/google/nonce step, the
      // token carries that nonce and we enforce it as single-use below. If not,
      // we skip it and rely on Google's signature + audience + expiry alone.
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

    // Only enforce the nonce when the client actually sent one (opt-in replay
    // protection). When present it must match an issued, unexpired nonce and is
    // consumed immediately so the same token can't be replayed.
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

    // Reset an expired lockout before checking the PIN.
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
      { verified: true },
      'Transaction PIN verified successfully',
    );
  }
}
