import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FxRate } from '../entities/fx-rate.entity';

@Injectable()
export class FxService {
  /**
   * Logger for monitoring FX operations.
   */
  private readonly logger = new Logger(FxService.name);

  constructor(
    @InjectRepository(FxRate)
    private readonly fxRepository: Repository<FxRate>,
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

    this.logger.log(
      `Saving FX rate ${baseCurrency}/${quoteCurrency}: ${rate}`,
    );

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

    return rate;
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