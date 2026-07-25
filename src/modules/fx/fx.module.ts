import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { FxRate } from './entities/fx-rate.entity';
import { FxService } from './fx.service';
import { ExchangeRateProvider } from './exchange-rate.provider';
import { FxSyncJob } from './fx-sync.job';
import { FxController } from './fx.controller';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([FxRate])],
  controllers: [FxController],
  providers: [FxService, ExchangeRateProvider, FxSyncJob],
  exports: [FxService],
})
export class FxModule {}
