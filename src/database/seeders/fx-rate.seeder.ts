import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { FxRate } from '../../modules/fx/entities/fx-rate.entity';

const logger = new Logger('FxRateSeeder');

export async function seedFxRate(dataSource: DataSource) {
  const fxRateRepository = dataSource.getRepository(FxRate);

  const existing = await fxRateRepository.findOne({
    where: {
      baseCurrency: 'USDC',
      quoteCurrency: 'NGN',
    },
  });

  if (existing) {
    logger.log('FX rate already exists. Skipping...');
    return existing;
  }

  const fxRate = fxRateRepository.create({
    baseCurrency: 'USDC',
    quoteCurrency: 'NGN',
    rate: '1550.00000000',
    source: 'Seed Script',
  });

  await fxRateRepository.save(fxRate);

  logger.log('FX rate created.');

  return fxRate;
}
