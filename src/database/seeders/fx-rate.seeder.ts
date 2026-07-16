import { DataSource } from 'typeorm';

import { FxRate } from '../../modules/fx/entities/fx-rate.entity';

export async function seedFxRate(dataSource: DataSource) {
  const fxRateRepository = dataSource.getRepository(FxRate);

  const existing = await fxRateRepository.findOne({
    where: {
      baseCurrency: 'USDC',
      quoteCurrency: 'NGN',
    },
  });

  if (existing) {
    console.log('ℹ️ FX rate already exists. Skipping...');
    return existing;
  }

  const fxRate = fxRateRepository.create({
    baseCurrency: 'USDC',
    quoteCurrency: 'NGN',
    rate: '1550.00000000',
    source: 'Seed Script',
  });

  await fxRateRepository.save(fxRate);

  console.log('✅ FX rate created.');

  return fxRate;
}
