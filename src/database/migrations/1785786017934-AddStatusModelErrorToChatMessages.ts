import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusModelErrorToChatMessages1785786017934 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
    CREATE TYPE "public"."chat_messages_status_enum" AS ENUM('success', 'failure')
  `);

    await queryRunner.query(`
    ALTER TABLE "chat_messages"
    ADD COLUMN "status" "public"."chat_messages_status_enum" NOT NULL DEFAULT 'success',
    ADD COLUMN "model" character varying,
    ADD COLUMN "error_message" text
  `);

    await queryRunner.query(`
    ALTER TABLE "chat_messages" ALTER COLUMN "content" DROP NOT NULL
  `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ALTER COLUMN "content" SET NOT NULL`,
    );
    await queryRunner.query(`
    ALTER TABLE "chat_messages"
    DROP COLUMN "status",
    DROP COLUMN "model",
    DROP COLUMN "error_message"
  `);
    await queryRunner.query(`DROP TYPE "public"."chat_messages_status_enum"`);
  }
}
