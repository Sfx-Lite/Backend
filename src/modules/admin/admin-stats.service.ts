import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { AdminStatsResponseDto } from './dto/admin-stats-response.dto';

@Injectable()
export class AdminStatsService {
  constructor(private readonly usersService: UsersService) {}

  async getStats(): Promise<AdminStatsResponseDto> {
    const users = await this.usersService.getUserStats();

    return {
      users,
      pendingKyc: null,
      volume: null,
      masterWallet: null,
    };
  }
}
