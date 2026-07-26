import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { WalletsModule } from '../wallets/wallets.module';
import { ChainModule } from '../chain/chain.module';
import { KycModule } from '../kyc/kyc.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    UsersModule,
    TransactionsModule,
    WalletsModule,
    ChainModule,
    KycModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
