import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatForeignKeys1784375244488 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
    ALTER TABLE "chat_conversations"
    ADD CONSTRAINT "FK_chat_conversations_user_id"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE
  `);

    await queryRunner.query(`
    ALTER TABLE "chat_messages"
    ADD CONSTRAINT "FK_chat_messages_conversation_id"
    FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id")
    ON DELETE CASCADE
  `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
    ALTER TABLE "chat_messages"
    DROP CONSTRAINT "FK_chat_messages_conversation_id"
  `);
    await queryRunner.query(`
    ALTER TABLE "chat_conversations"
    DROP CONSTRAINT "FK_chat_conversations_user_id"
  `);
  }
}
