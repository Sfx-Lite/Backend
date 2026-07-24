import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmailModule } from '../email/email.module';
import { User } from '../users/entities/user.entity';
import { entities } from './entities';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [TypeOrmModule.forFeature([...entities, User]), EmailModule],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
