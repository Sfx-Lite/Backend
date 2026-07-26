import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { KycVerifiedGuard } from '../../common/guards/kyc-verified.guard';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { Transaction } from './entities/transaction.entity';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransfersService } from './transfers.service';

/**
 * TransactionsModule — Squad C. Exports TransactionsService so the money flows
 * (deposit watcher, transfers, withdrawals, sweeps) can create and update the
 * business-level transaction records their ledger entries hang off.
 *
 * Hosts internal user-to-user transfers (TransfersService + controller), which
 * need the ledger (debit/credit), notifications (both parties) and users
 * (recipient lookup) — hence those imports.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    LedgerModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransfersService, KycVerifiedGuard],
  exports: [TransactionsService],
})
export class TransactionsModule {}
