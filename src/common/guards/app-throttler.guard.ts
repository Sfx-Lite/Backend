import { ExecutionContext, Injectable } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerRequest,
} from '@nestjs/throttler';
import { Response } from 'express';

/** The request fields the throttler reads to pick a tracking key. */
interface ThrottledRequest {
  user?: { id?: string; sub?: string };
  ips?: string[];
  ip?: string;
}

/**
 * Dual-tracker rate limiting:
 *  - Authenticated requests are tracked per USER ID (req.user is populated
 *    once Squad A's JWT guard runs) with the higher THROTTLE_LIMIT_USER.
 *  - Anonymous requests are tracked per IP with THROTTLE_LIMIT_IP.
 *
 * Behind Render/Vercel we trust the proxy (set in main.ts), so req.ips[0]
 * is the real client address, not the load balancer.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const r = req as ThrottledRequest;
    const userId = r.user?.id ?? r.user?.sub;
    if (userId) return Promise.resolve(`user:${userId}`);
    const ip = (r.ips?.length ? r.ips[0] : r.ip) ?? 'unknown';
    return Promise.resolve(`ip:${ip}`);
  }

  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    const { context, throttler } = requestProps;
    const req = context.switchToHttp().getRequest<ThrottledRequest>();
    const isAuthenticated = Boolean(req.user?.id ?? req.user?.sub);

    // Named throttlers let anonymous and authenticated traffic carry
    // different budgets from a single guard.
    if (throttler.name === 'user' && !isAuthenticated) return true;
    if (throttler.name === 'ip' && isAuthenticated) return true;

    return super.handleRequest(requestProps);
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const res = context.switchToHttp().getResponse<Response>();
    res.header('Retry-After', '60');
    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
