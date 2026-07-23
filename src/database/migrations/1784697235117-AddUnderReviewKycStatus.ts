import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnderReviewKycStatus1784697235117 implements MigrationInterface {
  name = 'AddUnderReviewKycStatus1784697235117';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."kyc_submissions_status_enum" RENAME TO "kyc_submissions_status_enum_old"`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."kyc_submissions_status_enum" AS ENUM('pending', 'under_review', 'approved', 'rejected')`,
    );

    await queryRunner.query(
      `ALTER TABLE "kyc_submissions" ALTER COLUMN "status" DROP DEFAULT`,
    );

    await queryRunner.query(
      `ALTER TABLE "kyc_submissions" ALTER COLUMN "status" TYPE "public"."kyc_submissions_status_enum" USING "status"::"text"::"public"."kyc_submissions_status_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "kyc_submissions" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );

    await queryRunner.query(
      `DROP TYPE "public"."kyc_submissions_status_enum_old"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."kyc_submissions_status_enum" RENAME TO "kyc_submissions_status_enum_old"`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."kyc_submissions_status_enum" AS ENUM('pending', 'approved', 'rejected')`,
    );

    await queryRunner.query(
      `ALTER TABLE "kyc_submissions" ALTER COLUMN "status" DROP DEFAULT`,
    );

    await queryRunner.query(
      `ALTER TABLE "kyc_submissions" ALTER COLUMN "status" TYPE "public"."kyc_submissions_status_enum" USING "status"::"text"::"public"."kyc_submissions_status_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "kyc_submissions" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );

    await queryRunner.query(
      `DROP TYPE "public"."kyc_submissions_status_enum_old"`,
    );
  }
}
