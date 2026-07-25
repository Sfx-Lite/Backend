import { Module } from '@nestjs/common';

import { FxModule } from '../fx/fx.module';

import { FeeService } from './fee.service';
import { FeesController } from './fees.controller';

@Module({
  imports: [FxModule],
  providers: [FeeService],
  controllers: [FeesController],
  exports: [FeeService],
})
export class FeesModule {}
