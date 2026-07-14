import { env } from './env';

/**
 * NestJS ConfigModule loader. It just returns the same `env` object defined in
 * env.ts, so there is ONE source of truth: modules already wired to
 * ConfigService keep working, while code that prefers a plain import can read
 * `env` directly (see env.ts).
 */
export default () => env;
