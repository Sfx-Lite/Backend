import { ExecutionContext, ForbiddenException } from '@nestjs/common';

import { KycStatus } from '../../modules/users/enums/kyc-status.enum';
import { UsersService } from '../../modules/users/users.service';
import { KycVerifiedGuard } from './kyc-verified.guard';

describe('KycVerifiedGuard', () => {
  let guard: KycVerifiedGuard;
  let users: jest.Mocked<Pick<UsersService, 'getKycStatus'>>;

  const contextFor = (sub?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user: sub ? { sub } : undefined }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    users = { getKycStatus: jest.fn() };
    guard = new KycVerifiedGuard(users as unknown as UsersService);
  });

  it('allows a verified user through', async () => {
    users.getKycStatus.mockResolvedValue(KycStatus.VERIFIED);

    await expect(guard.canActivate(contextFor('user-1'))).resolves.toBe(true);
    expect(users.getKycStatus).toHaveBeenCalledWith('user-1');
  });

  it.each([KycStatus.UNVERIFIED, KycStatus.PENDING, KycStatus.REJECTED, null])(
    'blocks a %s user',
    async (status) => {
      users.getKycStatus.mockResolvedValue(status);

      await expect(
        guard.canActivate(contextFor('user-1')),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('blocks a request with no authenticated user', async () => {
    await expect(guard.canActivate(contextFor())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(users.getKycStatus).not.toHaveBeenCalled();
  });
});
