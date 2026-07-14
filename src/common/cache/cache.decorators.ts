import { SetMetadata } from '@nestjs/common';

export const CACHE_TTL_METADATA = 'cache:ttl';
export const CACHE_KEY_METADATA = 'cache:key';

/**
 * Mark a GET route as cacheable. Opt-in: only routes with @Cacheable() are
 * cached by ResponseCacheInterceptor, so mutations are never cached by accident.
 *   @Cacheable()      → cache with the default TTL
 *   @Cacheable(300)   → cache for 300 seconds
 */
export const Cacheable = (ttlSeconds?: number) =>
  SetMetadata(CACHE_TTL_METADATA, ttlSeconds ?? true);

/**
 * Override the cache key for a route. By default the key is
 * `res:<userId|anon>:<url>`. Use this for a stable, shared key.
 */
export const CacheKey = (key: string) => SetMetadata(CACHE_KEY_METADATA, key);
