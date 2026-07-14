import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, tap } from 'rxjs';
import { CacheService } from './cache.service';
import { CACHE_KEY_METADATA, CACHE_TTL_METADATA } from './cache.decorators';

/**
 * Caches responses of GET routes marked with @Cacheable().
 * ───────────────────────────────────────────────────────
 * - Only touches routes that opted in, so writes are never cached.
 * - Keyed per user by default (`res:<userId|anon>:<url>`) so one user's
 *   cached data never leaks to another.
 * - Registered as the INNERMOST global interceptor, so it caches the raw
 *   controller return value; the response envelope + timestamp are re-applied
 *   fresh on every hit by TransformResponseInterceptor.
 * - If the cache is down, get()/set() degrade to misses — requests still serve.
 */
@Injectable()
export class ResponseCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cache: CacheService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const handler = context.getHandler();
    const ttlMeta = this.reflector.get<number | boolean>(CACHE_TTL_METADATA, handler);

    // Not marked @Cacheable → do nothing.
    if (ttlMeta === undefined) return next.handle();

    const req = context.switchToHttp().getRequest();
    if (req.method !== 'GET') return next.handle();

    const customKey = this.reflector.get<string>(CACHE_KEY_METADATA, handler);
    const userPart = req.user?.id ?? req.user?.sub ?? 'anon';
    const key = customKey ?? `res:${userPart}:${req.originalUrl}`;
    const ttl = typeof ttlMeta === 'number' ? ttlMeta : undefined;

    const cached = await this.cache.get(key);
    if (cached !== undefined) return of(cached);

    return next.handle().pipe(
      tap((body) => {
        void this.cache.set(key, body, ttl);
      }),
    );
  }
}
