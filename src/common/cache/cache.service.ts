import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface MemEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * CacheService — one cache API for the whole app.
 * ───────────────────────────────────────────────
 * Design goals:
 *  1. Cross-module: injected anywhere (it's provided by a @Global module).
 *  2. Graceful: if Redis is not configured OR not reachable, it silently
 *     falls back to a bounded in-memory store. Cache is an OPTIMISATION,
 *     never a hard dependency — a dev with no Docker/Redis, or a staging/prod
 *     box where Redis is down, keeps working.
 *  3. Safe: every operation is wrapped so a cache failure can never throw
 *     into a request. Worst case you get a cache miss.
 *
 * Redis is loaded dynamically, so `ioredis` does NOT need to be installed for
 * the app to run. Install it only if you want a shared/distributed cache:
 *   npm i ioredis   (then set REDIS_URL)
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Cache');
  private readonly mem = new Map<string, MemEntry>();

  private redis: any = null;
  private redisReady = false;
  private sweeper?: ReturnType<typeof setInterval>;

  private readonly defaultTtl: number;
  private readonly maxItems: number;

  constructor(private readonly config: ConfigService) {
    this.defaultTtl = this.config.get<number>('cache.ttlSeconds') ?? 60;
    this.maxItems = this.config.get<number>('cache.maxItems') ?? 1000;
  }

  async onModuleInit(): Promise<void> {
    // Evict expired in-memory entries periodically. unref() so it never
    // holds the process open on shutdown.
    this.sweeper = setInterval(() => this.sweep(), 30_000);
    this.sweeper.unref?.();

    const url = this.config.get<string>('cache.redisUrl');
    if (!url) {
      this.logger.log('No REDIS_URL set — using in-memory cache.');
      return;
    }

    try {
      // Indirect specifier so TypeScript doesn't try to resolve the (optional,
      // possibly uninstalled) package at build time. If it's absent, the
      // dynamic import throws here at runtime and we fall back cleanly.
      const pkg = 'ioredis';
      const mod: any = await import(pkg);
      const Redis = mod.default ?? mod;
      this.redis = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 1000)),
      });
      this.redis.on('ready', () => {
        this.redisReady = true;
        this.logger.log('Redis cache connected.');
      });
      this.redis.on('error', (err: Error) => {
        if (this.redisReady) this.logger.warn(`Redis error — falling back to in-memory cache: ${err.message}`);
        this.redisReady = false;
      });
      this.redis.on('end', () => {
        this.redisReady = false;
      });
      await this.redis.connect();
    } catch (err) {
      this.redis = null;
      this.redisReady = false;
      this.logger.warn(
        `Redis unavailable — using in-memory cache. Install "ioredis" and set REDIS_URL for a shared cache. (${(err as Error).message})`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sweeper) clearInterval(this.sweeper);
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        /* ignore — shutting down */
      }
    }
  }

  /** Which backend is live right now. Handy for /health or debugging. */
  get driver(): 'redis' | 'memory' {
    return this.redis && this.redisReady ? 'redis' : 'memory';
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      if (this.redis && this.redisReady) {
        const raw = await this.redis.get(key);
        return raw ? (JSON.parse(raw) as T) : undefined;
      }
    } catch (err) {
      this.logger.debug(`get() fell back to memory: ${(err as Error).message}`);
    }
    return this.memGet<T>(key);
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtl;
    try {
      if (this.redis && this.redisReady) {
        await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
        return;
      }
    } catch (err) {
      this.logger.debug(`set() fell back to memory: ${(err as Error).message}`);
    }
    this.memSet(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    try {
      if (this.redis && this.redisReady) await this.redis.del(key);
    } catch {
      /* ignore — best effort */
    }
    this.mem.delete(key);
  }

  /**
   * Read-through helper: return the cached value, or run `fn`, cache it, return it.
   *   const rate = await cache.wrap('fx:usd-ngn', () => fetchRate(), 30);
   */
  async wrap<T>(key: string, fn: () => Promise<T> | T, ttlSeconds?: number): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await fn();
    if (value !== undefined && value !== null) await this.set(key, value, ttlSeconds);
    return value;
  }

  // ── in-memory backend (bounded, TTL'd) ──────────────────────────────
  private memGet<T>(key: string): T | undefined {
    const entry = this.mem.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.mem.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  private memSet(key: string, value: unknown, ttl: number): void {
    // simple bound: drop the oldest inserted key when full
    if (this.mem.size >= this.maxItems) {
      const oldest = this.mem.keys().next().value;
      if (oldest !== undefined) this.mem.delete(oldest);
    }
    this.mem.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.mem) {
      if (entry.expiresAt < now) this.mem.delete(key);
    }
  }
}
