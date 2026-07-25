import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';

import { Notification } from './entities/notification.entity';
import { ListNotificationsQueryDto } from './dto/list-notifications.query.dto';

export interface CreateNotificationInput {
  userId: string;
  /** Category, e.g. 'deposit' | 'transfer' | 'withdrawal' | 'kyc'. */
  type: string;
  title: string;
  body: string;
}

export interface NotificationsPage {
  items: Notification[];
  total: number;
  limit: number;
  offset: number;
  unreadCount: number;
}

/**
 * NotificationsService — Squad A (Identity & KYC owns the module; consumed by
 * every squad). create() is called by other squads (e.g. Squad B's deposit
 * watcher) to emit an in-app notification. list()/markAsRead() below back the
 * user-facing GET/PATCH endpoints (BE-27).
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

  /**
   * List the current user's notifications, newest first, with paging and an
   * optional unread-only filter. Also returns the caller's total unread count
   * (independent of paging/filtering) so the frontend can render a badge
   * without a second round trip.
   */
  async listForUser(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<NotificationsPage> {
    const where: Record<string, unknown> = { userId };
    if (query.unreadOnly) {
      where.readAt = IsNull();
    }

    const [items, total] = await this.notifications.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: query.limit,
      skip: query.offset,
    });

    const unreadCount = await this.notifications.count({
      where: { userId, readAt: IsNull() },
    });

    return { items, total, limit: query.limit, offset: query.offset, unreadCount };
  }

  /**
   * Mark one of the caller's own notifications as read. Idempotent — marking
   * an already-read notification again just returns it unchanged, no error.
   * Ownership is enforced here (userId must match), so a user can never mark
   * -- or even discover the existence of -- another user's notification by id.
   */
  async markAsRead(userId: string, notificationId: string): Promise<Notification> {
    const notification = await this.notifications.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notifications.save(notification);
    }

    return notification;
  }

  /**
   * Mark every unread notification belonging to the caller as read in one
   * shot. Returns how many rows were actually updated.
   */
  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notifications
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: () => 'now()' })
      .where('user_id = :userId', { userId })
      .andWhere('read_at IS NULL')
      .execute();

    return { updated: result.affected ?? 0 };
  }
}