import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { env } from './config/env';
import { setupSwagger } from './config/swagger.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const port = env.port;
  const apiPrefix = env.apiPrefix;
  const isProd = env.nodeEnv === 'production';

  // Behind Render's proxy — makes req.ips carry the real client IP
  // so rate limiting tracks users, not the load balancer.
  app.set('trust proxy', 1);

  // ── Security & performance middleware ──
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());

  // ── CORS — array-driven from CORS_ORIGINS ──
  const origins = env.cors.origins;
  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  });

  // ── Routing shape: /api/v1/... ──
  app.setGlobalPrefix(`${apiPrefix}`);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: env.apiVersion,
  });

  // ── DTO validation everywhere ──
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: true, // ...and reject them loudly
      transform: true, // auto-cast params to DTO types
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Swagger — /docs (disabled in production) ──
  if (!isProd) {
    setupSwagger(app);
  }

  // Graceful shutdown — lets in-flight ledger writes finish on deploys.
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  logger.log(
    `SFx Lite API running on http://localhost:${port}/${apiPrefix}/v1`,
  );
  if (!isProd) logger.log(`Swagger docs on http://localhost:${port}/docs`);
}

bootstrap();
