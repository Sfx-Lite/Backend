import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { Notification } from './entities/notification.entity';

export interface CreateNotificationInput {
  userId: string;
  /** Category, e.g. 'deposit' | 'transfer' | 'withdrawal' | 'kyc'. */
  type: string;
  title: string;
  body: string;
}

/**
 * NotificationsService — Squad A (Identity & KYC owns the module; consumed by
 * every squad). Minimal create() scaffolded here so Squad B's deposit watcher
 * can notify a user when funds land. Read/list/mark-read endpoints are
 * Abdulsalam's to add on top.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
  ) {}

  /**
   * Persist an in-app notification. Pass a `manager` to fire it inside the same
   * transaction as the event it describes (e.g. the deposit credit), so a user
   * is never notified about a movement that rolled back.
   */
  async create(
    input: CreateNotificationInput,
    manager?: EntityManager,
  ): Promise<Notification> {
    const repo = manager
      ? manager.getRepository(Notification)
      : this.notifications;

    return repo.save(repo.create(input));
  }
}
