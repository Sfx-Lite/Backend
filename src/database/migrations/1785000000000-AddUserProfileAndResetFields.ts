import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the extended profile columns (middle name + structured address), the
 * account `tier` (defaults to 1), and the password-reset token fields to the
 * users table.
 */
export class AddUserProfileAndResetFields1785000000000
  implements MigrationInterface
{
  name = 'AddUserProfileAndResetFields1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "middle_name" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "street_address_1" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "street_address_2" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "city" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD "state" character varying`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "tier" smallint NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password_reset_token" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password_reset_expires_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "password_reset_expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "password_reset_token"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "tier"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "state"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "city"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "street_address_2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "street_address_1"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "middle_name"`);
  }
}
