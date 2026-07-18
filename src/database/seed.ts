import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import AppDataSource from './data-source';
import { seedUsers } from './seeders/user.seeder';
import { seedWallet } from './seeders/wallet.seeder';
import { seedBeneficiaries } from './seeders/beneficiary.seeder';
import { seedKycSubmission } from './seeders/kyc-submission.seeder';
import { seedFxRate } from './seeders/fx-rate.seeder';
import { seedNotification } from './seeders/notification.seeder';

const logger = new Logger('Seed');

async function seed() {
  try {
    await AppDataSource.initialize();

    logger.log('Database connection established.');

    // 👇 Put it here
    const user = await seedUsers(AppDataSource);

    await seedWallet(AppDataSource);

    await seedBeneficiaries(AppDataSource);

    await seedKycSubmission(AppDataSource);

    await seedFxRate(AppDataSource);

    await seedNotification(AppDataSource);

    logger.log(`Seeded user: ${user.email}`);

    logger.log('Database seeding completed.');
  } catch (error) {
    logger.error(
      'Seeding failed',
      error instanceof Error ? error.stack : String(error),
    );
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

void seed();
