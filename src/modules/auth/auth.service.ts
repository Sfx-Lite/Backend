import {
  Injectable,
  ConflictException,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { type StringValue } from 'ms';

import { env } from '../../config/env';
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

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly wallets: WalletsService,
  ) {}

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
   * Email + password login.
   *  1. Look up the user by email.
   *  2. Verify the password against the stored bcrypt hash.
   *  3. Issue an access + refresh token pair.
   *
   * The failure message is deliberately identical for "no such user",
   * "Google-only account" and "wrong password" so the endpoint can't be used
   * to enumerate which emails are registered.
   */
  async login(dto: LoginDto) {
    const user = await this.users.findOne({ where: { email: dto.email } });

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
}
