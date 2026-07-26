import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import { LedgerDirection } from '../enums/ledger-direction.enum';
import { DataSource } from 'typeorm';
import { CreateLedgerTransactionDto } from '../dto/create-ledger-transaction.dto';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepository: Repository<LedgerEntry>,
    private readonly dataSource: DataSource,
  ) {}

  async appendEntry(entry: Partial<LedgerEntry>): Promise<LedgerEntry> {
    this.logger.log(`Creating ledger entry for user ${entry.userId}`);

    const ledgerEntry = this.ledgerRepository.create(entry);

    return await this.ledgerRepository.save(ledgerEntry);
  }

  async recordTransaction(
    dto: CreateLedgerTransactionDto,
  ): Promise<LedgerEntry[]> {
    this.logger.log('Recording ledger transaction');

    this.validateBalancedEntries(dto.entries as LedgerEntry[]);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const savedEntries: LedgerEntry[] = [];

        for (const entry of dto.entries) {
          const previousEntry = await manager.findOne(LedgerEntry, {
            where: {
              userId: entry.userId,
            },
            order: {
              createdAt: 'DESC',
            },
          });

          const previousBalance = previousEntry
            ? Number(previousEntry.balanceAfter)
            : 0;

          const balanceAfter = this.computeBalance(
            previousBalance,
            Number(entry.amount),
            entry.direction,
          );

          const ledgerEntry = manager.create(LedgerEntry, {
            ...entry,
            balanceAfter: balanceAfter.toString(),
          });

          const saved = await manager.save(ledgerEntry);

          savedEntries.push(saved);
        }

        this.logger.log(
          `Ledger transaction recorded successfully with ${savedEntries.length} entries.`,
        );

        return savedEntries;
      });
    } catch (error) {
      this.logger.error(
        'Failed to record ledger transaction.',
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    }
  }

  private validateBalancedEntries(entries: LedgerEntry[]): void {
    let debit = 0;
    let credit = 0;

    for (const entry of entries) {
      const amount = Number(entry.amount);

      if (entry.direction === LedgerDirection.DEBIT) {
        debit += amount;
      } else {
        credit += amount;
      }
    }

    if (debit !== credit) {
      throw new BadRequestException('Ledger transaction is not balanced.');
    }
  }

  private computeBalance(
    previousBalance: number,
    amount: number,
    direction: LedgerDirection,
  ): number {
    if (direction === LedgerDirection.CREDIT) {
      return previousBalance + amount;
    }

    return previousBalance - amount;
  }
}
