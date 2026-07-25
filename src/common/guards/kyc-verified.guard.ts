import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

import { KycStatus } from '../../modules/users/enums/kyc-status.enum';
import { UsersService } from '../../modules/users/users.service';
import { AccessTokenPayload } from './jwt-auth.guard';

/**
 * KycVerifiedGuard — gates identity-restricted money actions.
 * ───────────────────────────────────────────────────────────
 * Per the product spec, sending and withdrawals unlock only once a user's
 * kyc_status is `verified`; deposits and receiving stay open. Apply this guard
 * (after the global JwtAuthGuard) on any route that moves money OUT of a user's
 * control — currently the internal transfer, and withdrawals once they exist.
 *
 * It reads the caller from the access-token claims (never trusts a body/param
 * id) and loads their current KYC status, so a status change takes effect on
 * the very next request without needing a re-issued token.
 */
@Injectable()
export class KycVerifiedGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AccessTokenPayload }>();

    const userId = request.user?.sub;

    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    const kycStatus = await this.users.getKycStatus(userId);

    if (kycStatus !== KycStatus.VERIFIED) {
      throw new ForbiddenException(
        'Verification is required to use this feature. Complete KYC verification to send money and make withdrawals.',
      );
    }

    return true;
  }
}
