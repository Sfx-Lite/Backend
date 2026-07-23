import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { FxService } from '../services/fx.service';

/**
 * FX Sync Job
 *
 * Periodically fetches exchange rates from the configured
 * provider and stores them in the database.
 *
 * This ensures the application always has fresh rates
 * without making external API calls during user requests.
 */
@Injectable()
export class FxSyncJob {
  /**
   * Logger for monitoring scheduled synchronization.
   */
  private readonly logger = new Logger(FxSyncJob.name);

  constructor(
    private readonly fxService: FxService,
  ) {}

  /**
   * Runs every 30 minutes.
   *
   * You may change the schedule later depending on
   * business requirements.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async synchronizeRates(): Promise<void> {
    this.logger.log(
      'Starting scheduled FX synchronization...',
    );

    try {
      await this.fxService.syncRates('USD');

      this.logger.log(
        'FX synchronization completed successfully.',
      );
    } catch (error) {
      this.logger.error(
        'FX synchronization failed.',
        error instanceof Error
          ? error.stack
          : undefined,
      );
    }
  }
}