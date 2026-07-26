import { Repository } from 'typeorm';

import { Transaction } from './entities/transaction.entity';
import { TransactionStatus } from './enums/transaction-status.enum';
import { TransactionType } from './enums/transaction-type.enum';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let repo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let service: TransactionsService;

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((v: Partial<Transaction>) => ({ ...v }) as Transaction),
      save: jest.fn((v: Transaction) => Promise.resolve({ ...v, id: 'tx-1' })),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
    };

    service = new TransactionsService(
      repo as unknown as Repository<Transaction>,
    );
  });

  it('records a confirmed deposit as a SUCCESSFUL deposit transaction', async () => {
    const tx = await service.createDeposit({
      userId: 'user-1',
      amount: '10.5',
      txHash: '0xabc',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.SUCCESSFUL,
        toUserId: 'user-1',
        txHash: '0xabc',
        amount: '10.500000',
        fee: '0.000000',
        asset: 'USDC',
      }),
    );
    expect(tx.id).toBe('tx-1');
  });

  it('looks up an existing deposit by (txHash, user) for idempotency', async () => {
    repo.findOne.mockResolvedValue({ id: 'tx-1' });

    const found = await service.findDepositByHashForUser('0xabc', 'user-1');

    expect(repo.findOne).toHaveBeenCalledWith({
      where: {
        txHash: '0xabc',
        toUserId: 'user-1',
        type: TransactionType.DEPOSIT,
      },
    });
    expect(found?.id).toBe('tx-1');
  });

  it('updates a transaction status', async () => {
    await service.markStatus('tx-1', TransactionStatus.FAILED);

    expect(repo.update).toHaveBeenCalledWith(
      { id: 'tx-1' },
      { status: TransactionStatus.FAILED },
    );
  });
});
