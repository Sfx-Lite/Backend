import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { FxProvider } from './interfaces/fx-provider.interface';

/**
 * Response returned by the exchangerate-api.com open (no-key) endpoint:
 * GET https://open.er-api.com/v6/latest/{BASE}
 */
interface ExchangeRateResponse {
  result: 'success' | 'error';
  base_code: string;
  time_last_update_unix: number;
  rates: Record<string, number>;
}

/**
 * ExchangeRateProvider — fetches informational FX rates from the
 * exchangerate-api.com open endpoint. It is free and needs no API key, and
 * (unlike ECB/Frankfurter) it covers NGN and KES, which the Rates screen
 * requires.
 */
@Injectable()
export class ExchangeRateProvider implements FxProvider {
  private readonly logger = new Logger(ExchangeRateProvider.name);

  private readonly BASE_URL = 'https://open.er-api.com/v6';

  constructor(private readonly httpService: HttpService) {}

  /** Retrieves the latest exchange rates keyed by currency code. */
  async getRates(baseCurrency: string): Promise<Record<string, number>> {
    this.logger.log(`Fetching FX rates for ${baseCurrency}`);

    try {
      const response = await firstValueFrom(
        this.httpService.get<ExchangeRateResponse>(
          `${this.BASE_URL}/latest/${baseCurrency}`,
        ),
      );

      const { result, rates } = response.data;

      if (result !== 'success' || !rates) {
        throw new HttpException(
          'Exchange rate provider returned an invalid response.',
          HttpStatus.BAD_GATEWAY,
        );
      }

      return rates;
    } catch (error) {
      this.logger.error(
        'Unable to fetch exchange rates.',
        error instanceof Error ? error.stack : undefined,
      );

      throw new HttpException(
        'Exchange rate provider unavailable.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
