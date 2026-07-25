import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../users/entities/user.entity';
import { Notification } from './entities/notification.entity';
import { KycSubmissionReceivedListener } from './listeners/kyc-submission-received.listener';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, User])],
  providers: [NotificationsService, KycSubmissionReceivedListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
