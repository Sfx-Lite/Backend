import { UnprocessableEntityException } from '@nestjs/common';

/**
 * Thrown when a debit would take a user's ledger balance below zero. 422 rather
 * than 400 because the request is well-formed — the account simply can't cover
 * it. Callers (internal transfer, withdrawal) surface this to the user as
 * "Insufficient funds".
 */
export class InsufficientFundsException extends UnprocessableEntityException {
  constructor(available: string, requested: string) {
    super({
      message: 'Insufficient funds',
      available,
      requested,
    });
  }
}
