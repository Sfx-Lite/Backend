import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

/**
 * HealthController
 * ────────────────
 * Thin HTTP layer. It declares routes + Swagger metadata and delegates
 * every bit of logic to HealthService. Copy this shape for new modules:
 *   @Controller('<resource>') sets the base path → /api/v1/<resource>
 *   each @Get/@Post method is one route; the body just calls the service.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  // GET /api/v1/health  → fast liveness, no I/O
  @Get()
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Fast process liveness with no I/O' })
  @ApiOkResponse({
    description: 'The process is up.',
    schema: {
      example: {
        status: true,
        message: 'Service is live',
        data: {
          status: 'ok',
          service: 'sfx-lite-api',
          env: 'development',
          version: 'v1',
          uptimeSeconds: 3600,
          timestamp: '2026-07-24T12:30:00.000Z',
        },
      },
    },
  })
  live() {
    return this.healthService.liveness();
  }

  // GET /api/v1/health/ready  → deep check (DB + memory)
  @Get('ready')
  @Public()
  @SkipThrottle()
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness + DB + memory health (used by Render + uptime pings)',
  })
  @ApiOkResponse({
    description: 'Terminus health-check result (raw, not enveloped).',
    schema: {
      example: {
        status: 'ok',
        info: { postgres: { status: 'up' } },
        error: {},
        details: { postgres: { status: 'up' } },
      },
    },
  })
  ready() {
    return this.healthService.readiness();
  }
}
