import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

import { env } from '../../config/env';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserRole } from '../../modules/users/enums/user-role.enum';

/** Claims carried in an access token (see AuthService.issueTokens). */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

/**
 * JwtAuthGuard — the global authentication boundary (Squad A).
 * ───────────────────────────────────────────────────────────
 * Registered as a global APP_GUARD, so EVERY route requires a valid access
 * token unless the handler (or its controller) is marked @Public().
 *
 * On success it verifies the Bearer token against `jwt.accessSecret` and puts
 * the decoded claims on `request.user`, which is what @CurrentUser() reads and
 * what AppThrottlerGuard uses to switch to the per-user rate-limit budget.
 *
 * Implemented directly on JwtService (no passport-jwt dependency) — the token
 * shape is our own, so a strategy would add a package without adding value.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: env.jwt.accessSecret!,
      });
      // Expose the caller to @CurrentUser() and the throttler.
      (request as Request & { user: AccessTokenPayload }).user = payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) {
      return undefined;
    }
    const [scheme, token] = header.split(' ');
    return scheme === 'Bearer' && token ? token : undefined;
  }
}
