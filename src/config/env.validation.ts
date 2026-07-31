import * as Joi from 'joi';
import * as dotenv from 'dotenv';

/**
 * Fails fast on boot if the environment is malformed.
 * Secrets that arrive later in the program (chain, Cloudinary, Anthropic)
 * are optional here and enforced by the modules that consume them.
 */
interface ValidatedEnvironment {
  NODE_ENV: 'development' | 'test' | 'staging' | 'production';
  PORT: number;
  API_PREFIX: string;
  API_VERSION: string;
  CORS_ORIGINS: string;
  THROTTLE_TTL_SECONDS: number;
  THROTTLE_LIMIT_IP: number;
  THROTTLE_LIMIT_USER: number;
  DATABASE_URL: string;
  DATABASE_SSL: boolean;
  DATABASE_LOGGING: boolean;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  REDIS_URL?: string;
  CACHE_TTL_SECONDS: number;
  CACHE_MAX_ITEMS: number;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  VOYAGE_API_URL: string;
  VOYAGE_API_KEY: string;
  GROQ_API_KEY: string;
  GROQ_MODEL: string;
}
dotenv.config();

export const envValidationSchema: Joi.ObjectSchema<ValidatedEnvironment> =
  Joi.object<ValidatedEnvironment>({
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
    DATABASE_LOGGING: Joi.boolean()
      .truthy('true')
      .falsy('false')
      .default(false),

    JWT_ACCESS_SECRET: Joi.string().min(8),
    JWT_REFRESH_SECRET: Joi.string().min(8),

    // Cache is optional — omit REDIS_URL to run on the in-memory fallback.
    REDIS_URL: Joi.string().uri().allow('').optional(),
    CACHE_TTL_SECONDS: Joi.number().min(1).default(60),
    CACHE_MAX_ITEMS: Joi.number().min(1).default(1000),

    RESEND_API_KEY: Joi.string().trim().allow('').optional(),
    RESEND_FROM_EMAIL: Joi.string().trim().allow('').optional(),

    VOYAGE_API_URL: Joi.string().uri(),
    VOYAGE_API_KEY: Joi.string().min(1),

    GROQ_API_KEY: Joi.string().min(1),
    GROQ_MODEL: Joi.string().min(1),
  });

const validationResult = envValidationSchema.validate(process.env, {
  abortEarly: false,
  allowUnknown: true,
});

if (validationResult.error) {
  throw new Error(`Config validation error: ${validationResult.error.message}`);
}

export const validatedEnv = validationResult.value;
