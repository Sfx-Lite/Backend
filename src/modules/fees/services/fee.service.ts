import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { FxService } from '../../fx/services/fx.service';

@Injectable()
export class FeeService {
  constructor(
    private readonly fxService: FxService,
    private readonly configService: ConfigService,
  ) {}

  async calculateFee(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ) {
    fromCurrency = fromCurrency.toUpperCase();
    toCurrency = toCurrency.toUpperCase();

    // Validate transfer amount
    if (!Number.isFinite(amount)) {
      throw new BadRequestException(
    'Amount must be a valid number.',
  );
}

    if (amount <= 0) {
      throw new BadRequestException(
    'Amount must be greater than zero.',
  );
}

    // Read fee rules from configuration
    const localPercentage =
      this.configService.get<number>(
        'fees.localPercentage',
      )!;

    const internationalPercentage =
      this.configService.get<number>(
        'fees.internationalPercentage',
      )!;

    const minimumFee =
      this.configService.get<number>(
        'fees.minimumFee',
      )!;

    const maximumFee =
      this.configService.get<number>(
        'fees.maximumFee',
      )!;

    const isLocal =
      fromCurrency === toCurrency;

    const percentage =
      isLocal
        ? localPercentage
        : internationalPercentage;

    let fee =
      amount * percentage;

    // Apply minimum fee
    if (fee < minimumFee) {
      fee = minimumFee;
    }

    // Apply maximum fee
    if (fee > maximumFee) {
      fee = maximumFee;
    }

    let exchangeRate = 1;

    let feeInDestinationCurrency = fee;

    // Convert fee into destination currency
    if (!isLocal) {
      try {

  exchangeRate =
    await this.fxService.getExchangeRate(
      fromCurrency,
      toCurrency,
    );

} catch {

  throw new NotFoundException(
    `No exchange rate exists for ${fromCurrency}/${toCurrency}.`,
  );
}

if (!Number.isFinite(exchangeRate)) {
  throw new BadRequestException(
    'Invalid exchange rate received.',
  );
}

if (exchangeRate <= 0) {
  throw new BadRequestException(
    'Exchange rate must be greater than zero.',
  );
}

feeInDestinationCurrency =
  Number(
    (fee * exchangeRate).toFixed(2),
  );
    }

    return {
      amount,

      fromCurrency,

      toCurrency,

      transferType:
        isLocal
          ? 'LOCAL'
          : 'INTERNATIONAL',

      percentage,

      fee:
        Number(fee.toFixed(2)),

      feeCurrency:
        fromCurrency,

      exchangeRate,

      feeInDestinationCurrency,

      minimumFee: Number(minimumFee.toFixed(2)),

      maximumFee: Number(maximumFee.toFixed(2)),
    };
  }
}