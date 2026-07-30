import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { LedgerModule } from '../ledger/ledger.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChainModule } from '../chain/chain.module';
import { Wallet } from './entities/wallet.entity';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { DepositWatcherService } from './deposit-watcher.service';
import { SweepService } from './sweep.service';
import { ReconciliationService } from './reconciliation.service';

/**
 * WalletsModule — Squad B (Wallet & Escrow)
 * Exports WalletsService so AuthModule can assign a deposit address at signup.
 * Hosts the deposit watcher, which credits confirmed on-chain USDC into the
 * ledger — hence the Ledger / Transactions / Notifications / Chain imports.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet]),
    LedgerModule,
    TransactionsModule,
    NotificationsModule,
    ChainModule,
    AuditModule,
  ],
  controllers: [WalletsController],
  providers: [
    WalletsService,
    DepositWatcherService,
    SweepService,
    ReconciliationService,
  ],
  exports: [WalletsService, ReconciliationService],
})
export class WalletsModule {}
