import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { AdminService } from './admin.service';
import { StatsOverviewResponseDto } from './dto/stats-overview-response.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('test')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Smoke-test admin authorization',
    description:
      'Returns a fixed payload if the caller holds an admin/super_admin role. ' +
      'Used to verify the Roles guard is wired up.',
  })
  @ApiOkResponse({
    description: 'Admin access granted.',
    schema: {
      example: {
        status: true,
        message: 'Success',
        data: { message: 'Admin access granted' },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Caller is not an admin.' })
  testAdminAccess() {
    return { message: 'Admin access granted' };
  }

  @Get('metrics/dashboard')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get admin dashboard overview stats' })
  @ApiOkResponse({
    description: 'Dashboard overview stats.',
    schema: {
      example: {
        status: true,
        message: 'Success',
        data: {
          users: { total: 1200, active: 1150, inactive: 50 },
          pendingKyc: 8,
          volume: 45230.75,
          masterWallet: 98765.43,
        },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Caller is not an admin.' })
  async getStatsOverview(): Promise<StatsOverviewResponseDto> {
    return this.adminService.getStatsOverview();
  }
}
