import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { CalculateFeeDto } from './dto/calculate-fee.dto';
import { FeeService } from './fee.service';

@ApiTags('fees')
@Controller({
  path: 'fees',
  version: '1',
})
export class FeesController {
  constructor(private readonly feeService: FeeService) {}

  /**
   * GET /api/v1/fees/calculate
   *
   * Example: /fees/calculate?amount=1000&from=USD&to=EUR
   */
  @Public()
  @Get('calculate')
  @ApiOperation({
    summary: 'Calculate the transfer fee for an amount and currency pair',
    description:
      'Applies the configured percentage (local vs international), clamped to ' +
      'the min/max fee, and converts the fee into the destination currency ' +
      'when the pair differs. Query params: amount, from, to.',
  })
  @ApiOkResponse({
    description: 'The calculated fee breakdown.',
    schema: {
      example: {
        status: true,
        message: 'Success',
        data: {
          amount: 1000,
          fromCurrency: 'USD',
          toCurrency: 'EUR',
          transferType: 'INTERNATIONAL',
          percentage: 0.01,
          fee: 10,
          feeCurrency: 'USD',
          exchangeRate: 0.92,
          feeInDestinationCurrency: 9.2,
          minimumFee: 1,
          maximumFee: 50,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Amount is not a positive number, or the pair is unsupported.',
  })
  async calculateFee(@Query() dto: CalculateFeeDto) {
    return this.feeService.calculateFee(dto.amount, dto.from, dto.to);
  }
}
