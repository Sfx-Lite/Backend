import { Logger } from '@nestjs/common';

const logger = new Logger('Redis');

/**
 * RedisLike — the minimal surface of the ioredis client the app actually uses.
 * Typing against this (instead of `any`) keeps `ioredis` optional while giving
 * every call site full type-safety.
 */
export interface RedisLike {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  connect(): Promise<unknown>;
  quit(): Promise<unknown>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttl: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

type RedisConstructor = new (
  url: string,
  options: Record<string, unknown>,
) => RedisLike;

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
export async function createRedisClient(
  url: string,
): Promise<RedisLike | null> {
  try {
    // Indirect specifier so TypeScript doesn't try to resolve the (optional,
    // possibly uninstalled) package at build time.
    const pkg = 'ioredis';
    const mod = (await import(pkg)) as unknown as {
      default?: RedisConstructor;
    } & RedisConstructor;
    const Redis: RedisConstructor = mod.default ?? mod;
    return new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times: number) =>
        times > 3 ? null : Math.min(times * 200, 1000),
    });
  } catch (err) {
    logger.warn(
      `ioredis not available — install "ioredis" for a shared cache. (${(err as Error).message})`,
    );
    return null;
  }
}
