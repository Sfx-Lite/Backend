import { DataSource } from 'typeorm';

import { User } from '../../modules/users/entities/user.entity';
import { KycSubmission } from '../../modules/kyc/entities/kyc-submission.entity';
import { KycDocType } from '../../modules/kyc/enums/kyc-doc-type.enum';
import { KycSubmissionStatus } from '../../modules/kyc/enums/kyc-submission-status.enum';

export async function seedKycSubmission(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);
  const kycRepository = dataSource.getRepository(KycSubmission);

  const user = await userRepository.findOne({
    where: {
      email: 'testuser@sfx.dev',
    },
  });

  if (!user) {
    throw new Error('Test user not found. Seed users first.');
  }

  const existing = await kycRepository.findOne({
    where: {
      userId: user.id,
    },
  });

  if (existing) {
    console.log('ℹ️ KYC submission already exists. Skipping...');
    return existing;
  }

  const submission = kycRepository.create({
    userId: user.id,
    docType: KycDocType.NATIONAL_ID,
    docUrl: 'https://example.com/documents/test-user-national-id.jpg',
    selfieUrl: 'https://example.com/selfies/test-user-selfie.jpg',
    status: KycSubmissionStatus.PENDING,
  });

  await kycRepository.save(submission);

  console.log('✅ Test KYC submission created.');

  return submission;
}
