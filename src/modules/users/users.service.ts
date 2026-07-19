import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
}
