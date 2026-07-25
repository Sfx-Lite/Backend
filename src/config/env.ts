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

  // Base URL of the web client — used to build user-facing links such as the
  // password-reset link emailed to users. Set FRONTEND_URL in production.
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',

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

  email: {
    resendApiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL,
  },

  cloudinary: {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
},

  chain: {
    rpcUrl: process.env.ALCHEMY_AMOY_RPC_URL,
    masterMnemonic: process.env.MASTER_WALLET_MNEMONIC,
    usdcAddress: process.env.USDC_TOKEN_ADDRESS,
    depositConfirmations: int(process.env.DEPOSIT_CONFIRMATIONS, 3),
    // Max block span per eth_getLogs call. Hosted RPC free tiers cap this
    // (Alchemy Amoy free tier = 10). The watcher pages the scan window into
    // chunks this size, so raise it only on a paid/self-hosted node.
    getLogsMaxRange: int(process.env.GETLOGS_MAX_RANGE, 10),
    // Per-request RPC timeout (ms). A slow/hung call aborts and the watcher
    // simply retries on the next poll instead of blocking for minutes.
    requestTimeoutMs: int(process.env.RPC_REQUEST_TIMEOUT_MS, 20_000),
    // Blocks to re-scan on a cold start (no in-memory checkpoint). Kept small so
    // the first poll isn't a big getLogs burst on a free RPC; overlap is safe
    // because crediting is idempotent.
    coldStartLookback: int(process.env.COLD_START_LOOKBACK, 120),
  },
} as const;

export type Env = typeof env;
