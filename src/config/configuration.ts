export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
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
    ttlSeconds: parseInt(process.env.THROTTLE_TTL_SECONDS ?? '60', 10),
    limitIp: parseInt(process.env.THROTTLE_LIMIT_IP ?? '30', 10),
    limitUser: parseInt(process.env.THROTTLE_LIMIT_USER ?? '100', 10),
  },

  database: {
    url: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true',
    logging: process.env.DATABASE_LOGGING === 'true',
  },

  cache: {
    // Optional. If unset (or unreachable) the app uses an in-memory cache.
    redisUrl: process.env.REDIS_URL,
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS ?? '60', 10),
    maxItems: parseInt(process.env.CACHE_MAX_ITEMS ?? '1000', 10),
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
    depositConfirmations: parseInt(process.env.DEPOSIT_CONFIRMATIONS ?? '3', 10),
  },
});
