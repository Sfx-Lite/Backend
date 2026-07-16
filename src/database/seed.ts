import 'reflect-metadata';
import AppDataSource from './data-source';
import { seedUsers } from './seeders/user.seeder';
import { seedWallet } from './seeders/wallet.seeder';
import { seedBeneficiaries } from './seeders/beneficiary.seeder';
import { seedKycSubmission } from './seeders/kyc-submission.seeder';
import { seedFxRate } from './seeders/fx-rate.seeder';
import { seedNotification } from './seeders/notification.seeder';

async function seed() {
  try {
    await AppDataSource.initialize();

    console.log('🌱 Database connection established.');

    // 👇 Put it here
    const user = await seedUsers(AppDataSource);

    await seedWallet(AppDataSource);

    await seedBeneficiaries(AppDataSource);

    await seedKycSubmission(AppDataSource);

    await seedFxRate(AppDataSource);

    await seedNotification(AppDataSource);

    console.log(`👤 Seeded user: ${user.email}`);

    console.log('✅ Database seeding completed.');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

void seed();
