import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * AuthModule  —  STRUCTURE REFERENCE ONLY (Squad A)
 * ─────────────────────────────────────────────────
 * This folder shows the SHAPE of a real feature module. The logic is
 * intentionally stubbed — fill it in when Squad A builds auth.
 *
 * A full module usually contains:
 *   auth.module.ts       ← this file: wires the pieces together
 *   auth.controller.ts   ← HTTP routes (POST /auth/login, /auth/register…)
 *   auth.service.ts      ← business logic (hashing, token issue/verify)
 *   dto/                 ← request/response shapes + validation rules
 *   entities/            ← (optional) TypeORM entities this module owns
 *   guards/ strategies/  ← (optional) JWT guard + passport strategies
 *
 * To activate it later:
 *   1. npm i @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
 *   2. uncomment the JwtModule import + providers below
 *   3. add `AuthModule` to AppModule.imports
 *
 * // import { JwtModule } from '@nestjs/jwt';
 * // import { ConfigModule, ConfigService } from '@nestjs/config';
 */
@Module({
  imports: [
    // JwtModule.registerAsync({
    //   imports: [ConfigModule],
    //   inject: [ConfigService],
    //   useFactory: (config: ConfigService) => ({
    //     secret: config.get<string>('jwt.accessSecret'),
    //     signOptions: { expiresIn: config.get<string>('jwt.accessExpiresIn') },
    //   }),
    // }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // JwtStrategy,           ← validates the access token on protected routes
    // { provide: APP_GUARD, useClass: JwtAuthGuard },  ← makes auth global
  ],
  exports: [AuthService],
})
export class AuthModule {}
