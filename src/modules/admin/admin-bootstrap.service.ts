import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const username = process.env.ADMIN_USERNAME?.trim();
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !username || !password) {
      this.logger.warn(
        'Admin bootstrap skipped: ADMIN_EMAIL, ADMIN_USERNAME, or ADMIN_PASSWORD is missing',
      );
      return;
    }

    const existingByEmail = await this.users.findOne({
      where: { email },
    });

    if (existingByEmail) {
      if (existingByEmail.role !== UserRole.ADMIN) {
        existingByEmail.role = UserRole.ADMIN;
        await this.users.save(existingByEmail);
        this.logger.log(`Promoted ${email} to admin`);
      } else {
        this.logger.log(`Admin already exists: ${email}`);
      }

      return;
    }

    const existingByUsername = await this.users.findOne({
      where: { username },
    });

    if (existingByUsername) {
      existingByUsername.role = UserRole.ADMIN;
      await this.users.save(existingByUsername);

      this.logger.log(`Promoted existing username "${username}" to admin`);

      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = this.users.create({
      email,
      username,
      passwordHash,
      role: UserRole.ADMIN,
    });

    await this.users.save(admin);

    this.logger.log(`Created admin account: ${email}`);
  }
}
