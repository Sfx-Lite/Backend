import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheckResult,
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

/**
 * HealthService
 * ─────────────
 * All health logic lives here so the controller stays thin (it only maps
 * HTTP → service call). This is the pattern every feature module follows:
 *   controller = HTTP surface (routes, DTO validation, Swagger)
 *   service    = business logic (talks to DB, other services, indicators)
 *
 * Terminus health indicators are injected here and composed into checks.
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly config: ConfigService,
  ) {}

  /**
   * Deep check — pings Postgres and inspects heap usage.
   * Used by Render's health probe and external uptime pings.
   */
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('postgres', { timeout: 3000 }),
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
    ]);
  }

  /**
   * Lightweight liveness payload — no I/O.
   * Handy for a fast "is the process up?" endpoint and as a template
   * for how a service returns a plain object the interceptor will wrap.
   */
  liveness() {
    return {
      status: 'ok',
      service: 'sfx-lite-api',
      env: this.config.get<string>('nodeEnv'),
      version: this.config.get<string>('apiVersion'),
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
