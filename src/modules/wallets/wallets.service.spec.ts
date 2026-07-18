import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { env } from '../../config/env';
import { Wallet } from './entities/wallet.entity';
import { WalletsService } from './wallets.service';

/**
 * Deterministic BIP-44 test vector: the standard "test junk" mnemonic derives
 * the well-known Hardhat/Anvil accounts at m/44'/60'/0'/0/{i}.
 */
const TEST_MNEMONIC =
  'test test test test test test test test test test test junk';
const EXPECTED = [
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // index 0
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // index 1
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // index 2
];

const setMnemonic = (phrase: string) => {
  (env.chain as { masterMnemonic?: string }).masterMnemonic = phrase;
};

describe('WalletsService', () => {
  let repo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let service: WalletsService;

  const makeService = () =>
    new WalletsService(
      repo as unknown as Repository<Wallet>,
      dataSource as unknown as DataSource,
    );

  beforeEach(() => {
    setMnemonic(TEST_MNEMONIC);

    repo = {
      findOne: jest.fn(),
      create: jest.fn((value: Partial<Wallet>) => value as Wallet),
      save: jest.fn((value: Wallet) => Promise.resolve(value)),
    };

    dataSource = { transaction: jest.fn() };

    service = makeService();
  });

  describe('deriveAddress', () => {
    it('derives the canonical checksummed address per index', () => {
      EXPECTED.forEach((address, index) => {
        expect(service.deriveAddress(index)).toBe(address);
      });
    });

    it('is deterministic', () => {
      expect(service.deriveAddress(7)).toBe(service.deriveAddress(7));
    });

    it('throws when the master mnemonic is not configured', () => {
      setMnemonic('');
      const unconfigured = makeService();
      expect(() => unconfigured.deriveAddress(0)).toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('createForUser', () => {
    // A minimal EntityManager stand-in that routes to the mocked repo and a
    // controllable nextval() for the derivation-index sequence.
    const managerWith = (nextIndex: number): EntityManager =>
      ({
        getRepository: () => repo,
        query: jest.fn(() => Promise.resolve([{ index: nextIndex }])),
      }) as unknown as EntityManager;

    it('allocates the sequence index, derives the address, and persists', async () => {
      repo.findOne.mockResolvedValue(null);
      const manager = managerWith(2);

      const wallet = await service.createForUser('user-1', manager);

      expect(wallet.derivationIndex).toBe(2);
      expect(wallet.depositAddress).toBe(EXPECTED[2]);
      expect(wallet.userId).toBe('user-1');
      expect(wallet.asset).toBe('USDC');
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('is idempotent — returns the existing wallet without deriving again', async () => {
      const existing = { id: 'w1', userId: 'user-1' } as Wallet;
      repo.findOne.mockResolvedValue(existing);
      const manager = managerWith(99);

      const wallet = await service.createForUser('user-1', manager);

      expect(wallet).toBe(existing);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('opens its own transaction when no manager is passed', async () => {
      repo.findOne.mockResolvedValue(null);
      dataSource.transaction.mockImplementation(
        (cb: (em: EntityManager) => Promise<Wallet>) => cb(managerWith(0)),
      );

      const wallet = await service.createForUser('user-1');

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(wallet.depositAddress).toBe(EXPECTED[0]);
    });
  });
});
