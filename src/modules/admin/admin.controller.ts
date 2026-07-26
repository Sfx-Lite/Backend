import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { AdminStatsService } from './admin-stats.service';
import { AdminStatsResponseDto } from './dto/admin-stats-response.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminStatsService: AdminStatsService) {}

  @Get('test')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Smoke-test admin role gating (admin only)' })
  @ApiOkResponse({ description: 'Admin access granted.' })
  testAdminAccess() {
    return {
      message: 'Admin access granted',
    };
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get admin dashboard stats',
    description:
      'Returns user counts plus pendingKyc/volume/masterWallet, which are currently null pending those services being built.',
  })
  @ApiResponse({ status: 200, type: AdminStatsResponseDto })
  async getStats(): Promise<AdminStatsResponseDto> {
    return this.adminStatsService.getStats();
  }
}
