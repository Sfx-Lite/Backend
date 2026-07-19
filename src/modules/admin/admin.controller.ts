import { Controller, Get } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('admin')
export class AdminController {
  @Get('test')
  @Roles(UserRole.ADMIN)
  testAdminAccess() {
    return {
      message: 'Admin access granted',
    };
  }
}
