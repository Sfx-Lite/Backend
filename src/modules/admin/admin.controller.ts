import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
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
  testAdminAccess() {
    return { message: 'Admin access granted' };
  }

  @Get('metrics/dashboard')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get admin dashboard overview stats' })
  @ApiResponse({ status: 200, type: StatsOverviewResponseDto })
  async getStatsOverview(): Promise<StatsOverviewResponseDto> {
    return this.adminService.getStatsOverview();
  }
}
