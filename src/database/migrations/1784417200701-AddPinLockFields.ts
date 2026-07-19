import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPinLockFields1784417200701 implements MigrationInterface {
  name = 'AddPinLockFields1784417200701';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_chat_messages_conversation_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_conversations" DROP CONSTRAINT "FK_chat_conversations_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "pin_failed_attempts" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "pin_locked_until" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "pin_locked_until"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "pin_failed_attempts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_conversations" ADD CONSTRAINT "FK_chat_conversations_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_chat_messages_conversation_id" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
