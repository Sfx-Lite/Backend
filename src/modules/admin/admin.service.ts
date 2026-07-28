import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { TransactionsService } from '../transactions/transactions.service';
import { WalletsService } from '../wallets/wallets.service';
import { ChainService } from '../chain/chain.service';
import { KycService } from '../kyc/kyc.service';
import { StatsOverviewResponseDto } from './dto/stats-overview-response.dto';

const VOLUME_WINDOW_DAYS = 7;

@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly transactionsService: TransactionsService,
    private readonly walletsService: WalletsService,
    private readonly chainService: ChainService,
    private readonly kycService: KycService,
    private readonly logger = new Logger(AdminService.name),
  ) {}

  async getStatsOverview(): Promise<StatsOverviewResponseDto> {
    const users = await this.usersService.getUserStats();

    const sevenDaysAgo = new Date(
      Date.now() - VOLUME_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const [volume, pendingKyc] = await Promise.all([
      this.transactionsService.getVolumeSince(sevenDaysAgo),
      this.kycService.countPending(),
    ]);
    const masterWallet = await this.getMasterWalletBalance();

    return { users, pendingKyc, volume, masterWallet };
  }

  private async getMasterWalletBalance(): Promise<number> {
    try {
      const address = this.walletsService.masterAddress();
      const balance = await this.chainService.usdcBalanceOf(address);
      return Number(balance);
    } catch (error) {
      this.logger.error(
        'Failed to fetch master wallet balance',
        error instanceof Error ? error.stack : error,
      );
      throw new ServiceUnavailableException(
        'Master wallet balance is temporarily unavailable',
        { cause: error },
      );
    }
  }
}
