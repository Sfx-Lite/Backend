import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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

  // GET /api/v1/health  → deep check (DB + memory)
  @Get()
  @Public()
  @SkipThrottle()
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness + DB + memory health (used by Render + uptime pings)' })
  check() {
    return this.healthService.check();
  }

  // GET /api/v1/health/live  → fast liveness, no I/O
  @Get('live')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Fast process liveness with no I/O' })
  live() {
    return this.healthService.liveness();
  }
}
