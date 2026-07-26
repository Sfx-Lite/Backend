import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller';

/**
 * AdminModule — admin-only surface. The root/super-admin is now provisioned on
 * first login (see AuthService.handleRootAdminLogin), so there is no startup
 * bootstrap here. Domain admin actions (KYC review, etc.) live in their own
 * modules, role-gated with @Roles(UserRole.ADMIN).
 */
@Module({
  controllers: [AdminController],
})
export class AdminModule {}
