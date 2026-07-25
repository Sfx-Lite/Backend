import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { Notification } from './entities/notification.entity';

export interface CreateNotificationOptions {
  userId: string;
  type: string;
  title: string;
  body: string;
}

export interface CreateAdminNotificationOptions {
  type: string;
  title: string;
  body: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async create(
    options: CreateNotificationOptions,
    entityManager?: EntityManager,
  ): Promise<Notification> {
    const repository = entityManager
      ? entityManager.getRepository(Notification)
      : this.notifications;

    const notification = repository.create(options);

    return repository.save(notification);
  }

  async createForAdmins(
    options: CreateAdminNotificationOptions,
  ): Promise<Notification[]> {
    const admins = await this.users.find({
      where: {
        role: UserRole.ADMIN,
      },
      select: {
        id: true,
      },
    });

    if (admins.length === 0) {
      return [];
    }

    const notifications = admins.map((admin) =>
      this.notifications.create({
        userId: admin.id,
        type: options.type,
        title: options.title,
        body: options.body,
      }),
    );

    return this.notifications.save(notifications);
  }
}
