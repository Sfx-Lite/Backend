import { Module } from '@nestjs/common';

import { ChainService } from './chain.service';

/**
 * ChainModule — Squad B. The one place a Polygon Amoy provider lives.
 * Exported for the deposit watcher, sweep and withdrawal jobs.
 */
@Module({
  providers: [ChainService],
  exports: [ChainService],
})
export class ChainModule {}
