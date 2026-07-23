import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { entities } from './entities';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [TypeOrmModule.forFeature([...entities])],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
