import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FxRate } from '../entities/fx-rate.entity';
import { ExchangeRateProvider } from '../providers/exchange-rate.provider';

@Injectable()
export class FxService {
  /**
   * Logger for monitoring FX operations.
   */
  private readonly logger = new Logger(FxService.name);

  constructor(
    @InjectRepository(FxRate)
    private readonly fxRepository: Repository<FxRate>,

    private readonly exchangeRateProvider: ExchangeRateProvider,
  ) {}

  /**
   * Stores a newly retrieved exchange rate.
   *
   * This method is called by the scheduled sync job
   * after rates are fetched from the external provider.
   */
  async saveRate(
    baseCurrency: string,
    quoteCurrency: string,
    rate: number,
    source: string,
  ): Promise<FxRate> {

    this.validateRate(rate);

    const fxRate = this.fxRepository.create({
      baseCurrency,
      quoteCurrency,
      rate: rate.toString(),
      source,
    });

    return await this.fxRepository.save(fxRate);
  }

  /**
   * Retrieves the latest exchange rate.
   *
   * Other modules (Transfers, Wallets,
   * Fee Engine) will use this method.
   */
  async getLatestRate(
    baseCurrency: string,
    quoteCurrency: string,
  ): Promise<FxRate> {

    const rate = await this.fxRepository.findOne({
      where: {
        baseCurrency,
        quoteCurrency,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (!rate) {
      throw new NotFoundException(
        `FX rate ${baseCurrency}/${quoteCurrency} not found.`,
      );
    }

    this.ensureRateIsFresh(rate);

    return rate;
  }

  /**
 * Retrieves an exchange rate between any two currencies.
 *
 * If a direct rate exists, it is returned.
 * Otherwise, the rate is calculated using USD
 * as the intermediate currency.
 */
async getExchangeRate(
  baseCurrency: string,
  quoteCurrency: string,
): Promise<number> {

  baseCurrency = baseCurrency.toUpperCase();
  quoteCurrency = quoteCurrency.toUpperCase();

  await this.ensureCurrencyExists(
  baseCurrency,
);

  await this.ensureCurrencyExists(
  quoteCurrency,
);

  /**
   * Same currency.
   *
   * Example:
   * USD -> USD
   */
  if (baseCurrency === quoteCurrency) {
    return 1;
  }

  /**
   * Direct conversion.
   *
   * Example:
   * USD -> EUR
   */
  if (baseCurrency === 'USD') {

    const rate = await this.getLatestRate(
      'USD',
      quoteCurrency,
    );

    return Number(rate.rate);
  }

  /**
   * Inverse conversion.
   *
   * Example:
   * EUR -> USD
   */
  if (quoteCurrency === 'USD') {

    const rate = await this.getLatestRate(
      'USD',
      baseCurrency,
    );

    return 1 / Number(rate.rate);
  }

  /**
   * Cross-currency conversion.
   *
   * Example:
   * EUR -> GBP
   *
   * Formula:
   * (USD -> GBP) / (USD -> EUR)
   */
  const baseRate = await this.getLatestRate(
    'USD',
    baseCurrency,
  );

  const quoteRate = await this.getLatestRate(
    'USD',
    quoteCurrency,
  );

  return (
    Number(quoteRate.rate) /
    Number(baseRate.rate)
  );
}
  /**
 * Synchronizes exchange rates from the provider.
 *
 * All exchange rates retrieved from the provider are stored
 * inside a single database transaction. This guarantees that
 * either every rate is stored successfully or none are.
 */
async syncRates(
  baseCurrency = 'USD',
): Promise<void> {

  this.logger.log(
    `Synchronizing FX rates for ${baseCurrency}`,
  );

  const rates =
    await this.exchangeRateProvider.fetchRates(
      baseCurrency,
    );

  const currencies =
    Object.entries(rates);

  this.logger.log(
    `Fetched ${currencies.length} exchange rates.`,
  );

  await this.fxRepository.manager.transaction(
    async (manager) => {

      for (const [quoteCurrency, rate] of currencies) {

        this.validateRate(rate);

        const fxRate =
          manager.create(FxRate, {
            baseCurrency,
            quoteCurrency,
            rate: rate.toString(),
            source: 'Frankfurter',
          });

        await manager.save(fxRate);
      }
    },
  );

  this.logger.log(
    `Stored ${currencies.length} exchange rates successfully.`,
  );
}


  /**
 * Ensures a currency exists in the FX database.
 */
private async ensureCurrencyExists(
  currency: string,
): Promise<void> {

  const exists =
    await this.fxRepository.exists({
      where: [
        { baseCurrency: currency },
        { quoteCurrency: currency },
      ],
    });

  if (!exists) {
    throw new BadRequestException(
      `Currency ${currency} is not supported.`,
    );
  }
}


  /**
 * Ensures an exchange rate is still fresh.
 */
private ensureRateIsFresh(
  fxRate: FxRate,
): void {

  const MAX_AGE_MINUTES = 60;

  const ageInMilliseconds =
    Date.now() -
    fxRate.createdAt.getTime();

  const ageInMinutes =
    ageInMilliseconds / 60000;

  if (ageInMinutes > MAX_AGE_MINUTES) {
    throw new ServiceUnavailableException(
      'Exchange rates are temporarily outdated. Please try again later.',
    );
  }
}

  /**
   * Validates exchange rates before saving.
   *
   * Prevents corrupt data from being stored.
   */
  private validateRate(rate: number): void {

    if (Number.isNaN(rate)) {
      throw new BadRequestException(
        'Exchange rate must be numeric.',
      );
    }

    if (rate <= 0) {
      throw new BadRequestException(
        'Exchange rate must be greater than zero.',
      );
    }
  }
}