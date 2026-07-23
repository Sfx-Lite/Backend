import { Module } from '@nestjs/common';

import { FxModule } from '../fx/fx.module';

import { FeeService } from './services/fee.service';
import { FeesController } from './controllers/fees.controller';

@Module({
  imports: [
    FxModule,
  ],
  providers: [
    FeeService,
  ],
  controllers: [
    FeesController,
  ],
  exports: [
    FeeService,
  ],
})
export class FeesModule {}