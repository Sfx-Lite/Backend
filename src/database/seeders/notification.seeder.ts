import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Notification } from '../../modules/notifications/entities/notification.entity';
import { User } from '../../modules/users/entities/user.entity';

const logger = new Logger('NotificationSeeder');

export async function seedNotification(dataSource: DataSource) {
  const notificationRepository = dataSource.getRepository(Notification);
  const userRepository = dataSource.getRepository(User);

  const user = await userRepository.findOne({
    where: {
      email: 'testuser@sfx.dev',
    },
  });

  if (!user) {
    throw new Error('Test user not found.');
  }

  const existing = await notificationRepository.findOne({
    where: {
      userId: user.id,
      title: 'Welcome to SFX',
    },
  });

  if (existing) {
    logger.log('Notification already exists. Skipping...');
    return existing;
  }

  const notification = notificationRepository.create({
    userId: user.id,
    type: 'welcome',
    title: 'Welcome to SFX',
    body: 'Your development account has been successfully seeded.',
  });

  await notificationRepository.save(notification);

  logger.log('Notification created.');

  return notification;
}
