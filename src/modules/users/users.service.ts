import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, IsNull, Not } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { sendResponse } from '../../common/utils/response.util';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from './entities/user.entity';
import { KycStatus } from './enums/kyc-status.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /** Shape a User row into the payload the profile page consumes. */
  private toProfile(user: User) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      mobileNumber: user.mobileNumber,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      streetAddress1: user.streetAddress1,
      streetAddress2: user.streetAddress2,
      city: user.city,
      state: user.state,
      country: user.country,
      tier: user.tier,
      role: user.role,
      kycStatus: user.kycStatus,
      isPin: Boolean(user.pinHash),
    };
  }

  /** GET /users/profile — the authenticated user's own profile + tier. */
  async getProfile(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return sendResponse(this.toProfile(user), 'Profile retrieved successfully');
  }

  /**
   * PATCH /users/profile — update the editable profile fields only. username
   * and email are not part of UpdateProfileDto and cannot be changed here.
   * mobileNumber is editable but must stay unique across users.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.users.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Only assign keys the client actually sent (PATCH semantics).
    const editable: (keyof UpdateProfileDto)[] = [
      'firstName',
      'middleName',
      'lastName',
      'streetAddress1',
      'streetAddress2',
      'city',
      'state',
      'country',
    ];

    const updates: Partial<Record<keyof UpdateProfileDto, string>> = {};

    for (const key of editable) {
      const value = dto[key];
      if (value !== undefined) {
        updates[key] = value.trim();
      }
    }

    Object.assign(user, updates);

    // mobileNumber is editable but unique — reject a number already held by a
    // different account before persisting.
    if (dto.mobileNumber !== undefined) {
      const mobileNumber = dto.mobileNumber.trim();

      const clash = await this.users.findOne({
        where: { mobileNumber, id: Not(userId) },
        select: { id: true },
      });

      if (clash) {
        throw new ConflictException('Mobile number already exists');
      }

      user.mobileNumber = mobileNumber;
    }

    const saved = await this.users.save(user);

    return sendResponse(this.toProfile(saved), 'Profile updated successfully');
  }

  /**
   * PATCH /users/update_password — change password after verifying the current
   * one. Google-only accounts (no password set) cannot use this route.
   */
  async updatePassword(userId: string, dto: UpdatePasswordDto) {
    const user = await this.users.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'This account has no password set. Sign in with Google or use forgot password.',
      );
    }

    const currentMatches = await bcrypt.compare(
      dto.oldPassword,
      user.passwordHash,
    );

    if (!currentMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.oldPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.users.save(user);

    return sendResponse(null, 'Password updated successfully');
  }

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
   * KYC status for a single user, or null if the user does not exist. Used by
   * KycVerifiedGuard to gate identity-restricted actions (send, withdraw).
   */
  async getKycStatus(id: string): Promise<KycStatus | null> {
    const user = await this.users.findOne({
      where: { id },
      select: { id: true, kycStatus: true },
    });

    return user?.kycStatus ?? null;
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

  async getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
  }> {
    const [total, inactive] = await Promise.all([
      this.users.count(),
      this.users.count({ where: { suspendedAt: Not(IsNull()) } }),
    ]);

    return { total, active: total - inactive, inactive };
  }
}
