import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';

import { FxService } from './fx.service';

@ApiTags('fx')
@Controller({
  path: 'fx',
  version: '1',
})
export class FxController {
  constructor(private readonly fxService: FxService) {}

  /**
   * GET /api/v1/fx/latest
   *
   * Examples:
   * /api/v1/fx/latest?base=USD&quote=EUR
   * /api/v1/fx/latest?base=EUR&quote=GBP
   * /api/v1/fx/latest?base=NGN&quote=KES
   */
  @Public()
  @Get('latest')
  @ApiOperation({
    summary: 'Get the latest informational exchange rate for a currency pair',
    description:
      'Returns the latest stored rate between two supported currencies ' +
      '(USD, NGN, TRY, EUR, GBP, ZAR, KES), pivoting through USD when needed. ' +
      'Informational only.',
  })
  @ApiQuery({
    name: 'base',
    example: 'USD',
    description:
      'Base currency (3-letter ISO). One of: USD, NGN, TRY, EUR, GBP, ZAR, KES.',
  })
  @ApiQuery({
    name: 'quote',
    example: 'NGN',
    description:
      'Quote currency (3-letter ISO). One of: USD, NGN, TRY, EUR, GBP, ZAR, KES.',
  })
  @ApiOkResponse({
    description: 'Latest exchange rate for the pair.',
    schema: {
      example: {
        status: true,
        message: 'Success',
        data: {
          baseCurrency: 'USD',
          quoteCurrency: 'NGN',
          rate: 1650.25,
        },
      },
    },
  })
  async getLatestRate(
    @Query('base') base: string,
    @Query('quote') quote: string,
  ) {
    const rate = await this.fxService.getExchangeRate(base, quote);

    return {
      baseCurrency: base.toUpperCase(),
      quoteCurrency: quote.toUpperCase(),
      rate,
    };
  }
}
