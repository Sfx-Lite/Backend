import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';

/**
 * NotificationsModule — Squad A. Exports NotificationsService so any squad can
 * emit in-app notifications (deposits, transfers, KYC decisions, …).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
