import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * ExchangeRateProvider
 *
 * Retrieves exchange rates from ExchangeRate.
 */
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
          this.httpService.get(
            `${this.BASE_URL}/latest`,
            {
              params: {
                from: baseCurrency,
              },
            },
          ),
        );

      /**
       * Frankfurter returns:
       *
       * {
       *   amount:1,
       *   base:"USD",
       *   date:"...",
       *   rates:{
       *      NGN:1548,
       *      EUR:0.85,
       *      GBP:0.74
       *   }
       * }
       */
      this.logger.debug(response.data);
      const rates = response.data?.rates;

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