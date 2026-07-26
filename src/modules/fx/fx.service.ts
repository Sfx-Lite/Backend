import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Currency, SUPPORTED_CURRENCIES } from './enums/currency.enum';
import { FxRate } from './entities/fx-rate.entity';
import { ExchangeRateProvider } from './exchange-rate.provider';

const RATE_SOURCE = 'exchangerate-api';

// Rates are informational only, so a stale rate is logged but still served —
// far better for a demo than a hard 5xx when the sync job hasn't run recently
// (e.g. after a free-tier cold start).
const STALE_AFTER_MINUTES = 60;

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);

  constructor(
    @InjectRepository(FxRate)
    private readonly fxRepository: Repository<FxRate>,
    private readonly exchangeRateProvider: ExchangeRateProvider,
  ) {}

  /**
   * Retrieves the latest stored rate for a pair (newest row wins). Throws only
   * when we have never stored the pair; a merely stale rate is returned with a
   * warning, since these rates are informational.
   */
  async getLatestRate(
    baseCurrency: string,
    quoteCurrency: string,
  ): Promise<FxRate> {
    const rate = await this.fxRepository.findOne({
      where: { baseCurrency, quoteCurrency },
      order: { createdAt: 'DESC' },
    });

    if (!rate) {
      throw new NotFoundException(
        `FX rate ${baseCurrency}/${quoteCurrency} not found.`,
      );
    }

    this.warnIfStale(rate);

    return rate;
  }

  /**
   * Converts between any two supported currencies, using USD as the pivot when
   * there is no direct pair (all rates are stored as USD → currency).
   */
  async getExchangeRate(
    baseCurrency: string,
    quoteCurrency: string,
  ): Promise<number> {
    const base = this.toSupportedCurrency(baseCurrency);
    const quote = this.toSupportedCurrency(quoteCurrency);

    if (base === quote) {
      return 1;
    }

    if (base === Currency.USD) {
      const rate = await this.getLatestRate(Currency.USD, quote);
      return Number(rate.rate);
    }

    if (quote === Currency.USD) {
      const rate = await this.getLatestRate(Currency.USD, base);
      return 1 / Number(rate.rate);
    }

    const [baseRate, quoteRate] = await Promise.all([
      this.getLatestRate(Currency.USD, base),
      this.getLatestRate(Currency.USD, quote),
    ]);

    return Number(quoteRate.rate) / Number(baseRate.rate);
  }

  /**
   * Fetches rates from the provider and stores one row per supported currency
   * inside a single transaction — either every rate lands or none do. Called by
   * the scheduled job (and once at boot).
   */
  async syncRates(baseCurrency: Currency = Currency.USD): Promise<void> {
    this.logger.log(`Synchronizing FX rates for ${baseCurrency}`);

    const rates = await this.exchangeRateProvider.getRates(baseCurrency);

    const pairs = SUPPORTED_CURRENCIES.filter(
      (currency) => currency !== baseCurrency && rates[currency] !== undefined,
    ).map((currency) => [currency, rates[currency]] as const);

    await this.fxRepository.manager.transaction(async (manager) => {
      for (const [quoteCurrency, rate] of pairs) {
        this.validateRate(rate);

        const fxRate = manager.create(FxRate, {
          baseCurrency,
          quoteCurrency,
          rate: rate.toString(),
          source: RATE_SOURCE,
        });

        await manager.save(fxRate);
      }
    });

    this.logger.log(`Stored ${pairs.length} exchange rates successfully.`);
  }

  private toSupportedCurrency(currency: string): Currency {
    const upper = currency.toUpperCase();

    if (!SUPPORTED_CURRENCIES.includes(upper as Currency)) {
      throw new BadRequestException(`Currency ${currency} is not supported.`);
    }

    return upper as Currency;
  }

  private warnIfStale(fxRate: FxRate): void {
    const ageMinutes = (Date.now() - fxRate.createdAt.getTime()) / 60000;

    if (ageMinutes > STALE_AFTER_MINUTES) {
      this.logger.warn(
        `Serving a stale FX rate ${fxRate.baseCurrency}/${fxRate.quoteCurrency} ` +
          `(${Math.round(ageMinutes)} min old). The sync job may not have run recently.`,
      );
    }
  }

  private validateRate(rate: number): void {
    if (Number.isNaN(rate)) {
      throw new BadRequestException('Exchange rate must be numeric.');
    }

    if (rate <= 0) {
      throw new BadRequestException('Exchange rate must be greater than zero.');
    }
  }
}
