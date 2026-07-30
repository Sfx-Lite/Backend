import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a profile image URL to users. Nullable — most accounts won't have one.
 * Surfaced on the profile, in username search, and alongside saved beneficiaries.
 */
export class AddProfileImageToUsers1785600000000 implements MigrationInterface {
  name = 'AddProfileImageToUsers1785600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "profile_image" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "profile_image"`,
    );
  }
}
