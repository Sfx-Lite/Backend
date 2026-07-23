import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';

import { Public } from '../../../common/decorators/public.decorator';

import { CalculateFeeDto } from '../dto/calculate-fee.dto';

import { FeeService } from '../services/fee.service';

@Controller({
  path: 'fees',
  version: '1',
})
export class FeesController {

  constructor(
    private readonly feeService: FeeService,
  ) {}

  /**
   * GET
   * /api/v1/fees/calculate
   *
   * Example:
   *
   * /fees/calculate?amount=1000&from=USD&to=EUR
   */

  @Public()
  @Get('calculate')
  async calculateFee(
    @Query() dto: CalculateFeeDto,
  ) {

    return this.feeService.calculateFee(

      dto.amount,

      dto.from,

      dto.to,
    );
  }
}