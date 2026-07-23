import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Transaction } from './entities/transaction.entity';
import { TransactionsService } from './transactions.service';

/**
 * TransactionsModule — Squad C. Exports TransactionsService so the money flows
 * (deposit watcher, transfers, withdrawals, sweeps) can create and update the
 * business-level transaction records their ledger entries hang off.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Transaction])],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
