import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { FxRate } from './entities/fx-rate.entity';
import { FxService } from './services/fx.service';
import { ExchangeRateProvider } from './providers/exchange-rate.provider';
import { FxSyncJob } from './jobs/fx-sync.job';
import { FxController } from './controllers/fx.controller';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      FxRate,
    ]),
  ],
  controllers: [
    FxController,
  ],

  providers: [
    FxService,
    ExchangeRateProvider,
    FxSyncJob,
  ],
  exports: [
    FxService,
  ],
})
export class FxModule {}