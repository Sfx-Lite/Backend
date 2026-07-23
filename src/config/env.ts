import * as dotenv from 'dotenv';

/**
 * env — the single, typed source of truth for environment variables, loaded
 * with dotenv (not @nestjs/config). Import `env` anywhere and read a value
 * directly, e.g. `env.cache.redisUrl`, instead of injecting ConfigService.
 *
 * dotenv.config() runs once when this module is first imported, so anything
 * that reads `env` sees a populated process.env — including code that runs
 * outside Nest's DI container (the CacheService, the typeorm CLI, scripts).
 */
dotenv.config();

const int = (value: string | undefined, fallback: number): number => {
  const n = parseInt(value ?? '', 10);
  return Number.isNaN(n) ? fallback : n;
};

const bool = (value: string | undefined): boolean => value === 'true';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: int(process.env.PORT, 4000),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  apiVersion: process.env.API_VERSION ?? '1',

  cors: {
    // "a,b,c" -> ['a','b','c'] — trimmed, empties removed
    origins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  throttle: {
    ttlSeconds: int(process.env.THROTTLE_TTL_SECONDS, 60),
    limitIp: int(process.env.THROTTLE_LIMIT_IP, 30),
    limitUser: int(process.env.THROTTLE_LIMIT_USER, 100),
  },

  database: {
    url: process.env.DATABASE_URL,
    ssl: bool(process.env.DATABASE_SSL),
    logging: bool(process.env.DATABASE_LOGGING),
  },

  cache: {
    // Optional. If unset (or unreachable) the app uses an in-memory cache.
    redisUrl: process.env.REDIS_URL,
    ttlSeconds: int(process.env.CACHE_TTL_SECONDS, 60),
    maxItems: int(process.env.CACHE_MAX_ITEMS, 1000),
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },

  chain: {
    rpcUrl: process.env.ALCHEMY_AMOY_RPC_URL,
    masterMnemonic: process.env.MASTER_WALLET_MNEMONIC,
    usdcAddress: process.env.USDC_TOKEN_ADDRESS,
    depositConfirmations: int(process.env.DEPOSIT_CONFIRMATIONS, 3),
  },

  voyage: {
    apiUrl: process.env.VOYAGE_API_URL,
  },
} as const;

export type Env = typeof env;
