import { DataSource, EntityManager, Repository } from 'typeorm';

import { env } from '../../config/env';
import { ChainService, UsdcTransfer } from '../chain/chain.service';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionsService } from '../transactions/transactions.service';
import { Wallet } from './entities/wallet.entity';
import { DepositWatcherService } from './deposit-watcher.service';

// Canonical checksummed test address (Hardhat account #0).
const ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const USER = 'user-1';

describe('DepositWatcherService', () => {
  let wallets: { find: jest.Mock };
  let chain: {
    isConfigured: jest.Mock;
    getBlockNumber: jest.Mock;
    queryUsdcTransfersTo: jest.Mock;
  };
  let transactions: {
    findDepositByHashForUser: jest.Mock;
    createDeposit: jest.Mock;
  };
  let ledger: { credit: jest.Mock };
  let notifications: { create: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let service: DepositWatcherService;

  const em = {} as EntityManager;

  beforeEach(() => {
    wallets = { find: jest.fn() };
    chain = {
      isConfigured: jest.fn(() => true),
      getBlockNumber: jest.fn(),
      queryUsdcTransfersTo: jest.fn(),
    };
    transactions = {
      findDepositByHashForUser: jest.fn(),
      createDeposit: jest.fn(),
    };
    ledger = { credit: jest.fn() };
    notifications = { create: jest.fn() };
    dataSource = {
      transaction: jest.fn((cb: (m: EntityManager) => Promise<unknown>) =>
        cb(em),
      ),
    };

    service = new DepositWatcherService(
      wallets as unknown as Repository<Wallet>,
      chain as unknown as ChainService,
      transactions as unknown as TransactionsService,
      ledger as unknown as LedgerService,
      notifications as unknown as NotificationsService,
      dataSource as unknown as DataSource,
    );
  });

  const transfer: UsdcTransfer = {
    to: ADDR,
    from: '0x0000000000000000000000000000000000000001',
    amount: '10.5',
    txHash: '0xdeadbeef',
    logIndex: 0,
    blockNumber: 100,
  };

  describe('handleDeposit', () => {
    it('records, credits and notifies a new deposit atomically', async () => {
      transactions.findDepositByHashForUser.mockResolvedValue(null);
      transactions.createDeposit.mockResolvedValue({ id: 'tx-1' });
      ledger.credit.mockResolvedValue({ balanceAfter: '10.500000' });
      notifications.create.mockResolvedValue({});

      const result = await service.handleDeposit(USER, transfer);

      expect(result).toEqual({
        credited: true,
        transactionId: 'tx-1',
        balanceAfter: '10.500000',
      });
      expect(transactions.createDeposit).toHaveBeenCalledWith(
        { userId: USER, amount: '10.5', txHash: '0xdeadbeef', asset: 'USDC' },
        em,
      );
      expect(ledger.credit).toHaveBeenCalledWith(
        'tx-1',
        USER,
        '10.5',
        'USDC',
        em,
      );
      expect(notifications.create).toHaveBeenCalledTimes(1);
    });

    it('is idempotent — skips a deposit already recorded', async () => {
      transactions.findDepositByHashForUser.mockResolvedValue({ id: 'tx-1' });

      const result = await service.handleDeposit(USER, transfer);

      expect(result).toEqual({ credited: false });
      expect(transactions.createDeposit).not.toHaveBeenCalled();
      expect(ledger.credit).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });
  });

  describe('scanOnce', () => {
    it('maps confirmed transfers to users and hands them to handleDeposit', async () => {
      chain.getBlockNumber.mockResolvedValue(1000);
      wallets.find.mockResolvedValue([
        { userId: USER, depositAddress: ADDR },
      ]);
      chain.queryUsdcTransfersTo.mockResolvedValue([transfer]);

      const handle = jest
        .spyOn(service, 'handleDeposit')
        .mockResolvedValue({ credited: true, transactionId: 'tx-1' });

      await service.scanOnce();

      expect(handle).toHaveBeenCalledWith(USER, transfer);
      // Scans only up to the confirmed head (chain head − confirmations).
      const safeHead = 1000 - env.chain.depositConfirmations;
      expect(chain.queryUsdcTransfersTo).toHaveBeenCalledWith(
        [ADDR],
        expect.any(Number),
        safeHead,
      );
    });

    it('ignores transfers to addresses we do not own', async () => {
      chain.getBlockNumber.mockResolvedValue(1000);
      wallets.find.mockResolvedValue([]); // no user wallets
      chain.queryUsdcTransfersTo.mockResolvedValue([]);

      const handle = jest.spyOn(service, 'handleDeposit');

      await service.scanOnce();

      expect(chain.queryUsdcTransfersTo).not.toHaveBeenCalled();
      expect(handle).not.toHaveBeenCalled();
    });
  });

  describe('poll', () => {
    it('stays idle when the chain is not configured', async () => {
      chain.isConfigured.mockReturnValue(false);
      const scan = jest.spyOn(service, 'scanOnce');

      await service.poll();

      expect(scan).not.toHaveBeenCalled();
    });
  });
});
