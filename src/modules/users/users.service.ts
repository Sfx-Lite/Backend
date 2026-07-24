import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { sendResponse } from '../../common/utils/response.util';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async checkUsername(username: string) {
    const existingUser = await this.users.findOne({
      where: { username },
      select: { id: true },
    });

    const available = !existingUser;

    return sendResponse(
      { username, available },
      available ? 'Username is available' : 'Username is already taken',
    );
  }

  /**
   * Find a user by exact username — used to resolve a transfer recipient.
   * Returns null if no such user. Selects only what callers need.
   */
  findByUsername(username: string): Promise<User | null> {
    return this.users.findOne({
      where: { username },
      select: { id: true, username: true, suspendedAt: true },
    });
  }

  /** Minimal lookup by id, e.g. to name the sender in a notification. */
  findById(id: string): Promise<User | null> {
    return this.users.findOne({
      where: { id },
      select: { id: true, username: true },
    });
  }

  /**
   * Batch-resolve id → username for a set of user ids, e.g. to label the
   * counterparties on a transaction-history page in one query instead of N.
   */
  async findUsernamesByIds(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) {
      return new Map();
    }

    const rows = await this.users.find({
      where: { id: In(unique) },
      select: { id: true, username: true },
    });

    return new Map(rows.map((u) => [u.id, u.username]));
  }
}
