import { Injectable, NotImplementedException } from '@nestjs/common';
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
  // constructor(
  //   @InjectRepository(User) private readonly users: Repository<User>,
  //   private readonly jwt: JwtService,
  // ) {}

  register(dto: RegisterDto) {
    void dto;
    // 1. reject if email already exists
    // 2. hash password with bcrypt
    // 3. persist the user
    // 4. issue access + refresh tokens
    throw new NotImplementedException('AuthService.register — Squad A to implement');
  }

  login(dto: LoginDto) {
    void dto;
    // 1. look up user by email
    // 2. compare password hash
    // 3. issue access + refresh tokens
    throw new NotImplementedException('AuthService.login — Squad A to implement');
  }

  refresh(refreshToken: string) {
    void refreshToken;
    // 1. verify refresh token signature + expiry
    // 2. issue a fresh access token
    throw new NotImplementedException('AuthService.refresh — Squad A to implement');
  }
}
