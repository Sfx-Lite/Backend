import { Module } from '@nestjs/common';

import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { AdminStatsService } from './admin-stats.service';
import { AdminController } from './admin.controller';

/**
 * AdminModule — admin-only surface. The root/super-admin is now provisioned on
 * first login (see AuthService.handleRootAdminLogin), so there is no startup
 * bootstrap here. Domain admin actions (KYC review, etc.) live in their own
 * modules, role-gated with @Roles(UserRole.ADMIN).
 */
@Module({
  imports: [TypeOrmModule.forFeature([User]), UsersModule],
  controllers: [AdminController],
  providers: [AdminBootstrapService, AdminStatsService],
})
export class AdminModule {}
