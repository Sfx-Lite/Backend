import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { formatEther, parseEther } from 'ethers';
import { In, Repository } from 'typeorm';

import { env } from '../../config/env';
import { AuditService } from '../audit/audit.service';
import { AuditCategory } from '../audit/enums/audit-category.enum';
import { AuditLevel } from '../audit/enums/audit-level.enum';
import { ChainService } from '../chain/chain.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { WalletsService } from '../wallets/wallets.service';
import {
  GasHealthResponseDto,
  GasHealthStatus,
} from './dto/gas-health-response.dto';

/**
 * MasterWalletGasService — the runtime low-POL alert for the master hot wallet.
 *
 * The master wallet pays native POL for every sweep gas-drop and every
 * withdrawal broadcast. When it drains, sweeps and withdrawals both fail with
 * INSUFFICIENT_FUNDS — and the user only sees an opaque 503. This service reads
 * the reserve on demand (no keys, no spend), prices one withdrawal from the
 * live gas price, and — when the balance falls below MIN_POL_FLOOR — records a
 * HIGH audit event and notifies every admin so the drain surfaces as a warning
 * instead of an outage. Backs GET /admin/gas.
 */
@Injectable()
export class MasterWalletGasService {
  private readonly logger = new Logger(MasterWalletGasService.name);

  constructor(
    private readonly chain: ChainService,
    private readonly wallets: WalletsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /**
   * Compute the master wallet's gas health. Read-only. When the POL balance is
   * below the floor it raises an admin alert (HIGH audit log + a notification to
   * every admin) as a side effect, then returns the snapshot either way.
   */
  async check(): Promise<GasHealthResponseDto> {
    const masterAddress = this.wallets.masterAddress();

    const [balanceWei, cost] = await Promise.all([
      this.chain.getNativeBalance(masterAddress),
      this.chain.estimateWithdrawalCostWei(),
    ]);

    const floorWei = parseEther(env.chain.minPolFloor);
    const withdrawalsRemaining =
      cost.costWei > 0n ? Number(balanceWei / cost.costWei) : 0;

    let status: GasHealthStatus;
    if (balanceWei >= floorWei) {
      status = 'healthy';
    } else if (withdrawalsRemaining >= 1) {
      status = 'low';
    } else {
      status = 'empty';
    }

    const snapshot: GasHealthResponseDto = {
      masterAddress,
      polBalance: formatEther(balanceWei),
      perWithdrawalPol: formatEther(cost.costWei),
      withdrawalsRemaining,
      floorPol: env.chain.minPolFloor,
      status,
      alerted: false,
      checkedAt: new Date().toISOString(),
    };

    if (status !== 'healthy') {
      snapshot.alerted = await this.raiseAlert(snapshot);
    }

    return snapshot;
  }

  /**
   * Record the low-gas condition (HIGH audit) and notify every admin. Best
   * effort: a logging or notification failure must never break the read, so we
   * swallow errors and just report that the alert didn't fully land.
   */
  private async raiseAlert(snapshot: GasHealthResponseDto): Promise<boolean> {
    this.logger.warn(
      `Master wallet LOW on gas: ${snapshot.polBalance} POL (floor ${snapshot.floorPol}, ` +
        `~${snapshot.withdrawalsRemaining} withdrawals left) — sweeps/withdrawals at risk`,
    );

    try {
      await this.audit.saveLog({
        action: 'wallet.gas_low',
        category: AuditCategory.WALLET,
        level: AuditLevel.HIGH,
        entity: 'wallet',
        entityId: snapshot.masterAddress,
        metadata: {
          polBalance: snapshot.polBalance,
          floorPol: snapshot.floorPol,
          perWithdrawalPol: snapshot.perWithdrawalPol,
          withdrawalsRemaining: snapshot.withdrawalsRemaining,
          status: snapshot.status,
        },
      });

      const admins = await this.users.find({
        where: { role: In([UserRole.ADMIN, UserRole.SUPER_ADMIN]) },
        select: { id: true },
      });

      const title =
        snapshot.status === 'empty'
          ? 'Master wallet out of gas'
          : 'Master wallet low on gas';
      const body =
        `Master wallet holds ${snapshot.polBalance} POL (floor ${snapshot.floorPol}). ` +
        `About ${snapshot.withdrawalsRemaining} withdrawal(s) can still be funded. ` +
        `Top it up to keep sweeps and withdrawals flowing.`;

      await Promise.all(
        admins.map((admin) =>
          this.notifications.create({
            userId: admin.id,
            type: 'system',
            title,
            body,
          }),
        ),
      );

      return true;
    } catch (err) {
      this.logger.error(
        `Failed to raise low-gas admin alert: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
