import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMobileNumberToUsers1784650000000 implements MigrationInterface {
  name = 'AddMobileNumberToUsers1784650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "mobile_number" character varying(20)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mobile_number"`);
  }
}
