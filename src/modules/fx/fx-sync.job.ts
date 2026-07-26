import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { FxService } from './fx.service';

/**
 * FxSyncJob — keeps stored exchange rates fresh so user requests never make an
 * external call. It runs once at boot (rates exist immediately, even after a
 * free-tier cold start) and then every 30 minutes.
 */
@Injectable()
export class FxSyncJob implements OnApplicationBootstrap {
  private readonly logger = new Logger(FxSyncJob.name);

  constructor(private readonly fxService: FxService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.synchronizeRates();
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async synchronizeRates(): Promise<void> {
    this.logger.log('Starting scheduled FX synchronization...');

    try {
      await this.fxService.syncRates();
      this.logger.log('FX synchronization completed successfully.');
    } catch (error) {
      this.logger.error(
        'FX synchronization failed.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
