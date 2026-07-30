import { Module } from '@nestjs/common';

import { KycVerifiedGuard } from '../../common/guards/kyc-verified.guard';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ChainModule } from '../chain/chain.module';
import { FeesModule } from '../fees/fees.module';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';
import { WalletsModule } from '../wallets/wallets.module';
import { WithdrawalConfirmationService } from './withdrawal-confirmation.service';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';

/**
 * WithdrawalsModule — Squad B. Money OUT: the POST /withdrawals endpoint plus
 * the background confirmation/refund job. Kept separate from WalletsModule to
 * avoid a cycle — AuthModule (needed here for PIN verification) already imports
 * WalletsModule for signup address assignment.
 */
@Module({
  imports: [
    AuthModule,
    FeesModule,
    ChainModule,
    LedgerModule,
    TransactionsModule,
    NotificationsModule,
    WalletsModule,
    UsersModule,
    AuditModule,
  ],
  controllers: [WithdrawalsController],
  providers: [
    WithdrawalsService,
    WithdrawalConfirmationService,
    KycVerifiedGuard,
  ],
})
export class WithdrawalsModule {}
