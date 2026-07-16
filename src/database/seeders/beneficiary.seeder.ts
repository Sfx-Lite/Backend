import { DataSource } from 'typeorm';

import { Beneficiary } from '../../modules/beneficiaries/entities/beneficiary.entity';
import { BeneficiaryType } from '../../modules/beneficiaries/enums/beneficiary-type.enum';
import { User } from '../../modules/users/entities/user.entity';

export async function seedBeneficiaries(dataSource: DataSource) {
  const beneficiaryRepository = dataSource.getRepository(Beneficiary);
  const userRepository = dataSource.getRepository(User);

  const user = await userRepository.findOne({
    where: {
      email: 'testuser@sfx.dev',
    },
  });

  if (!user) {
    throw new Error('Test user not found. Seed users first.');
  }

  const existing = await beneficiaryRepository.findOne({
    where: {
      userId: user.id,
      identifier: 'johndoe',
    },
  });

  if (existing) {
    console.log('ℹ️ Beneficiary already exists. Skipping...');
    return existing;
  }

  const beneficiary = beneficiaryRepository.create({
    userId: user.id,
    name: 'John Doe',
    type: BeneficiaryType.INTERNAL,
    identifier: 'johndoe',
  });

  await beneficiaryRepository.save(beneficiary);

  console.log('✅ Test beneficiary created.');

  return beneficiary;
}
