import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { LedgerService } from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { TransactionsService } from './transactions.service';
import { TransfersService } from './transfers.service';

describe('TransfersService', () => {
  const SENDER = 'sender-id';
  const RECIPIENT = 'recipient-id';

  let users: { findByUsername: jest.Mock; findById: jest.Mock };
  let transactions: { createInternalTransfer: jest.Mock };
  let ledger: { transfer: jest.Mock };
  let notifications: { create: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let service: TransfersService;

  beforeEach(() => {
    users = {
      findByUsername: jest.fn(),
      findById: jest.fn().mockResolvedValue({ id: SENDER, username: 'alice' }),
    };
    transactions = {
      createInternalTransfer: jest.fn().mockResolvedValue({ id: 'tx-1' }),
    };
    ledger = {
      transfer: jest
        .fn()
        .mockResolvedValue([
          { balanceAfter: '5.000000' },
          { balanceAfter: '15.000000' },
        ]),
    };
    notifications = { create: jest.fn().mockResolvedValue(undefined) };
    // Run the callback with a dummy EntityManager, like a real DB transaction.
    dataSource = {
      transaction: jest.fn((cb: (em: EntityManager) => unknown) =>
        cb({} as EntityManager),
      ),
    };

    service = new TransfersService(
      users as unknown as UsersService,
      transactions as unknown as TransactionsService,
      ledger as unknown as LedgerService,
      notifications as unknown as NotificationsService,
      dataSource as unknown as DataSource,
    );
  });

  it('posts an atomic transfer and notifies both parties', async () => {
    users.findByUsername.mockResolvedValue({ id: RECIPIENT, username: 'bob' });

    const result = await service.transfer(SENDER, {
      recipientUsername: 'bob',
      amount: '10.5',
    });

    // Normalised amount flows into both the transaction row and the ledger.
    expect(transactions.createInternalTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        fromUserId: SENDER,
        toUserId: RECIPIENT,
        amount: '10.500000',
        asset: 'USDC',
      }),
      expect.anything(),
    );
    expect(ledger.transfer).toHaveBeenCalledWith(
      'tx-1',
      SENDER,
      RECIPIENT,
      '10.500000',
      'USDC',
      expect.anything(),
    );
    // One notification each for sender and recipient.
    expect(notifications.create).toHaveBeenCalledTimes(2);

    expect(result).toEqual({
      transactionId: 'tx-1',
      amount: '10.500000',
      asset: 'USDC',
      recipient: 'bob',
      balanceAfter: '5.000000',
    });
  });

  it('rejects a non-positive amount before touching the DB', async () => {
    await expect(
      service.transfer(SENDER, { recipientUsername: 'bob', amount: '0' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(users.findByUsername).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('404s when the recipient username does not exist', async () => {
    users.findByUsername.mockResolvedValue(null);

    await expect(
      service.transfer(SENDER, { recipientUsername: 'ghost', amount: '1' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a transfer to yourself', async () => {
    users.findByUsername.mockResolvedValue({ id: SENDER, username: 'alice' });

    await expect(
      service.transfer(SENDER, { recipientUsername: 'alice', amount: '1' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
