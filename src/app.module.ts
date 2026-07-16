import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';

import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { HttpLoggerMiddleware } from './common/middleware/http-logger.middleware';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { CacheModule } from './common/cache/cache.module';
import { ResponseCacheInterceptor } from './common/cache/response-cache.interceptor';
import { THROTTLER_IP, THROTTLER_USER } from './common/constants';

import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),

    // Dual-budget rate limiting — resolved by AppThrottlerGuard:
    // 'ip' applies to anonymous traffic, 'user' to authenticated traffic.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: THROTTLER_IP,
            ttl: config.get<number>('throttle.ttlSeconds')! * 1000,
            limit: config.get<number>('throttle.limitIp')!,
          },
          {
            name: THROTTLER_USER,
            ttl: config.get<number>('throttle.ttlSeconds')! * 1000,
            limit: config.get<number>('throttle.limitUser')!,
          },
        ],
      }),
    }),

    ScheduleModule.forRoot(), // deposit watcher / sweep / reconciliation jobs (Squad B)
    CacheModule, // global cache — Redis if REDIS_URL is set & reachable, else in-memory
    DatabaseModule,
    HealthModule,

    // ── Feature modules land here as squads ship them ──
    AuthModule, // Squad A
    // UsersModule, KycModule, NotificationsModule   (Squad A)
    // WalletsModule, DepositsModule, SweepsModule, WithdrawalsModule, ReconciliationModule (Squad B)
    // LedgerModule, TransfersModule, BeneficiariesModule, HistoryModule, FxModule (Squad C)
    // ChatModule, AdminModule (Squad D)
    AnalyticsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    // Innermost interceptor: caches @Cacheable() GET routes on the raw
    // controller return, so the envelope is re-applied fresh on cache hits.
    { provide: APP_INTERCEPTOR, useClass: ResponseCacheInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, HttpLoggerMiddleware).forRoutes('*');
  }
}