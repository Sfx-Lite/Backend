import {
  Injectable,
  ConflictException,
  NotImplementedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/**
 * AuthService — Squad A
 * ─────────────────────
 * The controller never touches the DB, hashes, or tokens directly — it
 * calls these methods.
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

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
    const payload = { sub: user.id, email: user.email, role: user.role };

    // getOrThrow: these two are Joi-required at boot, so they're always
    // defined at runtime — getOrThrow tells TypeScript that too (plain
    // .get<string>() types as `string | undefined`, which is what was
    // breaking signAsync's overload resolution).
    //
    // `as any` on expiresIn: jsonwebtoken's newer types want a branded
    // `StringValue` (from the `ms` package) instead of a plain string,
    // even though a plain string like '15m' is exactly what it accepts
    // at runtime. This is a known typing friction point with
    // @nestjs/jwt + jsonwebtoken v9 — not a real type-safety hole here,
    // since the value always comes from our own validated env config.
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessExpiresIn', '15m') as any,
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      expiresIn: this.config.get<string>('jwt.refreshExpiresIn', '7d') as any,
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

    const tokens = await this.issueTokens(user);

    return {
      message: 'Registration successful',
      ...tokens,
      user: this.toPublicUser(user),
    };
  }

  login(dto: LoginDto) {
    void dto;
    // 1. look up user by email
    // 2. compare password hash
    // 3. issue access + refresh tokens
    throw new NotImplementedException(
      'AuthService.login — Squad A to implement',
    );
  }

  refresh(refreshToken: string) {
    void refreshToken;
    // 1. verify refresh token signature + expiry
    // 2. issue a fresh access token
    throw new NotImplementedException(
      'AuthService.refresh — Squad A to implement',
    );
  }
}