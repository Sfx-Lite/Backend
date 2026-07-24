import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LedgerEntry } from './entities/ledger-entry.entity';
import { LedgerService } from './ledger.service';

/**
 * LedgerModule — Squad C (Payments & Ledger).
 * Exports LedgerService so the money squads can post entries:
 *   • WalletsModule / deposit watcher → credit on confirmed deposit
 *   • Payments → internal transfers (debit + credit)
 *   • Escrow → withdrawals (debit, then broadcast)
 */
@Module({
  imports: [TypeOrmModule.forFeature([LedgerEntry])],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
