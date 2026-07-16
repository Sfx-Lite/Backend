import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

import { User } from '../../modules/users/entities/user.entity';
import { UserRole } from '../../modules/users/enums/user-role.enum';
import { KycStatus } from '../../modules/users/enums/kyc-status.enum';

export async function seedUsers(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);

  const existingUser = await userRepository.findOne({
    where: {
      email: 'testuser@sfx.dev',
    },
  });

  if (existingUser) {
    console.log('ℹ️ Test user already exists. Skipping...');
    return existingUser;
  }

  const passwordHash = await bcrypt.hash('Test@1234', 12);

  const user = userRepository.create({
    username: 'testuser',
    email: 'testuser@sfx.dev',
    passwordHash,
    role: UserRole.USER,
    firstName: 'Test',
    lastName: 'User',
    country: 'Nigeria',
    kycStatus: KycStatus.UNVERIFIED,
  });

  await userRepository.save(user);

  console.log('✅ Test user created.');

  return user;
}
