import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { BeneficiariesController } from './beneficiaries.controller';
import { BeneficiariesService } from './beneficiaries.service';
import { Beneficiary } from './entities/beneficiary.entity';

/**
 * BeneficiariesModule — Squad C. Saved payees CRUD. Imports UsersModule to
 * validate internal usernames and resolve their avatars for the list view.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Beneficiary]), UsersModule],
  controllers: [BeneficiariesController],
  providers: [BeneficiariesService],
  exports: [BeneficiariesService],
})
export class BeneficiariesModule {}
