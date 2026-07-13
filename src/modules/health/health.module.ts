import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/**
 * HealthModule
 * ────────────
 * The canonical shape of a feature module:
 *   imports     → other modules this one needs (TerminusModule here)
 *   controllers → the HTTP surface
 *   providers   → services/repositories (injectable business logic)
 *   exports     → providers other modules may inject (none needed here)
 *
 * Register the module in AppModule.imports to activate its routes.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
