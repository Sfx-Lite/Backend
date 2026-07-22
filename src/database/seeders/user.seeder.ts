import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

import { User } from '../../modules/users/entities/user.entity';
import { UserRole } from '../../modules/users/enums/user-role.enum';
import { KycStatus } from '../../modules/users/enums/kyc-status.enum';

const logger = new Logger('UserSeeder');

export async function seedUsers(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);

  const existingUser = await userRepository.findOne({
    where: {
      email: 'testuser@sfx.dev',
    },
  });

  if (existingUser) {
    logger.log('Test user already exists. Skipping...');
    return existingUser;
  }

  const passwordHash = await bcrypt.hash('Test@1234', 12);

  const user = userRepository.create({
    username: 'testuser',
    email: 'testuser@sfx.dev',
    mobileNumber: '+2348000000000',
    passwordHash,
    role: UserRole.USER,
    firstName: 'Test',
    lastName: 'User',
    country: 'Nigeria',
    kycStatus: KycStatus.UNVERIFIED,
  });

  await userRepository.save(user);

  logger.log('Test user created.');

  return user;
}
