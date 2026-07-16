import {
  Injectable,
  ConflictException,
  NotImplementedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/**
 * AuthService — STRUCTURE REFERENCE ONLY (Squad A)
 * ────────────────────────────────────────────────
 * Where the real work lives. The controller never touches the DB, hashes,
 * or tokens directly — it calls these methods. Everything below throws
 * NotImplementedException so the shape is visible without pretending to work.
 *
 * When implementing, a service typically injects:
 *   @InjectRepository(User) private readonly users: Repository<User>
 *   private readonly jwt: JwtService
 *   private readonly config: ConfigService
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}
 async register(dto: RegisterDto) {
  const existingUser = await this.users.findOne({
    where: [
      { email: dto.email },
      { username: dto.username },
    ],
  });

  if (existingUser) {
    throw new ConflictException(
      'Email or username already exists',
    );
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

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = await this.jwt.signAsync(payload, {
    expiresIn: '15m',
  });

  const refreshToken = await this.jwt.signAsync(payload, {
    expiresIn: '7d',
  });

  return {
    message: 'Registration successful',
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
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
