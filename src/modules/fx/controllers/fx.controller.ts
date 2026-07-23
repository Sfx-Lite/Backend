import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';

import { Public } from '../../../common/decorators/public.decorator';

import { FxService } from '../services/fx.service';

@Controller({
  path: 'fx',
  version: '1',
})
export class FxController {
  constructor(
    private readonly fxService: FxService,
  ) {}

  /**
   * GET /api/v1/fx/latest
   *
   * Examples:
   * /api/v1/fx/latest?base=USD&quote=EUR
   * /api/v1/fx/latest?base=EUR&quote=GBP
   * /api/v1/fx/latest?base=CAD&quote=JPY
   */
  @Public()
  @Get('latest')
  async getLatestRate(
    @Query('base') base: string,
    @Query('quote') quote: string,
  ) {
    const rate =
      await this.fxService.getExchangeRate(
        base,
        quote,
      );

    return {
      baseCurrency: base.toUpperCase(),
      quoteCurrency: quote.toUpperCase(),
      rate,
    };
  }
}