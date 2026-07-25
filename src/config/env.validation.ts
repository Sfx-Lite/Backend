import * as Joi from 'joi';

/**
 * Fails fast on boot if the environment is malformed.
 * Secrets that arrive later in the program (chain, Cloudinary, Anthropic)
 * are optional here and enforced by the modules that consume them.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().port().default(4000),
  API_PREFIX: Joi.string().default('api'),
  API_VERSION: Joi.string().default('1'),

  CORS_ORIGINS: Joi.string().allow('').default(''),

  THROTTLE_TTL_SECONDS: Joi.number().min(1).default(60),
  THROTTLE_LIMIT_IP: Joi.number().min(1).default(30),
  THROTTLE_LIMIT_USER: Joi.number().min(1).default(100),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .trim()
    .min(1)
    .required(),
  DATABASE_SSL: Joi.boolean().truthy('true').falsy('false').default(false),
  DATABASE_LOGGING: Joi.boolean().truthy('true').falsy('false').default(false),

  JWT_ACCESS_SECRET: Joi.string().min(8).required(),
  JWT_REFRESH_SECRET: Joi.string().min(8).required(),

  // Cache is optional — omit REDIS_URL to run on the in-memory fallback.
  REDIS_URL: Joi.string().uri().allow('').optional(),
  CACHE_TTL_SECONDS: Joi.number().min(1).default(60),
  CACHE_MAX_ITEMS: Joi.number().min(1).default(1000),

  RESEND_API_KEY: Joi.string().trim().allow('').optional(),
  RESEND_FROM_EMAIL: Joi.string().trim().allow('').optional(),
});
