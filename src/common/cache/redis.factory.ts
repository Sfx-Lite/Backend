import { Logger } from '@nestjs/common';

const logger = new Logger('Redis');

/**
 * createRedisClient — the ONE place that knows how to build an ioredis client.
 *
 * `ioredis` is imported dynamically (indirect specifier) so the package stays
 * OPTIONAL: the app runs without it, and this returns `null` when it isn't
 * installed. Reuse this anywhere a raw Redis client is needed (cache, queues,
 * rate-limiting, pub/sub) so the connection options live in a single spot.
 *
 * Event wiring (ready/error/end) is left to the caller, since different
 * consumers care about connection state differently.
 */
export async function createRedisClient(url: string): Promise<any | null> {
  try {
    // Indirect specifier so TypeScript doesn't try to resolve the (optional,
    // possibly uninstalled) package at build time.
    const pkg = 'ioredis';
    const mod: any = await import(pkg);
    const Redis = mod.default ?? mod;
    return new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 1000)),
    });
  } catch (err) {
    logger.warn(
      `ioredis not available — install "ioredis" for a shared cache. (${(err as Error).message})`,
    );
    return null;
  }
}
