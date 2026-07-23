import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Response returned by exchangerate.fun
 */
interface ExchangeRateResponse {
  timestamp: number;
  base: string;
  rates: Record<string, number>;
}

@Injectable()
export class ExchangeRateProvider {
  private readonly logger =
    new Logger(ExchangeRateProvider.name);

  private readonly BASE_URL =
    'https://api.exchangerate.fun';

  constructor(
    private readonly httpService: HttpService,
  ) {}

  /**
   * Retrieves the latest exchange rates.
   */
  async fetchRates(
    baseCurrency: string,
  ): Promise<Record<string, number>> {
    this.logger.log(
      `Fetching FX rates for ${baseCurrency}`,
    );

    try {
      const response =
        await firstValueFrom(
          this.httpService.get<ExchangeRateResponse>(
            `${this.BASE_URL}/latest`,
            {
              params: {
                from: baseCurrency,
              },
            },
          ),
        );

      this.logger.debug(response.data);

      const { rates } = response.data;

      if (!rates) {
        throw new HttpException(
          'Exchange rate provider returned an invalid response.',
          HttpStatus.BAD_GATEWAY,
        );
      }

      return rates;
    } catch (error) {
      this.logger.error(
        'Unable to fetch exchange rates.',
        error instanceof Error
          ? error.stack
          : undefined,
      );

      throw new HttpException(
        'Exchange rate provider unavailable.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}