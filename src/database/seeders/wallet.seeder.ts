import { DataSource } from 'typeorm';

import { Wallet } from '../../modules/wallets/entities/wallet.entity';
import { User } from '../../modules/users/entities/user.entity';

export async function seedWallet(dataSource: DataSource) {
  const walletRepository = dataSource.getRepository(Wallet);
  const userRepository = dataSource.getRepository(User);

  const user = await userRepository.findOne({
    where: {
      email: 'testuser@sfx.dev',
    },
  });

  if (!user) {
    throw new Error('Test user not found. Seed users first.');
  }

  const existingWallet = await walletRepository.findOne({
    where: {
      userId: user.id,
    },
  });

  if (existingWallet) {
    console.log('ℹ️ Wallet already exists. Skipping...');
    return existingWallet;
  }

  const wallet = walletRepository.create({
    userId: user.id,
    depositAddress: '0x1234567890abcdef1234567890abcdef12345678',
    derivationIndex: 0,
    asset: 'USDC',
    sweptBalance: '0.000000',
  });

  await walletRepository.save(wallet);

  console.log('✅ Test wallet created.');

  return wallet;
}
