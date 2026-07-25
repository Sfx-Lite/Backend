import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
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
}
