import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPin2faEnabledToUsers1785887641002
  implements MigrationInterface
{
  name = 'AddPin2faEnabledToUsers1785887641002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "pin_2fa_enabled" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "pin_2fa_enabled"`,
    );
  }
}