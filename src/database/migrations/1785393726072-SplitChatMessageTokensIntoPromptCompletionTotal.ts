import { MigrationInterface, QueryRunner } from 'typeorm';

export class SplitChatMessageTokensIntoPromptCompletionTotal1785393726072 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
    ALTER TABLE "chat_messages"
    ADD COLUMN "prompt_tokens" integer,
    ADD COLUMN "completion_tokens" integer,
    ADD COLUMN "total_tokens" integer
  `);

    await queryRunner.query(`
    UPDATE "chat_messages" SET "total_tokens" = "tokens"
  `);

    await queryRunner.query(`
    ALTER TABLE "chat_messages" DROP COLUMN "tokens"
  `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
    ALTER TABLE "chat_messages" ADD COLUMN "tokens" integer
  `);

    await queryRunner.query(`
    UPDATE "chat_messages" SET "tokens" = "total_tokens"
  `);

    await queryRunner.query(`
    ALTER TABLE "chat_messages"
    DROP COLUMN "prompt_tokens",
    DROP COLUMN "completion_tokens",
    DROP COLUMN "total_tokens"
  `);
  }
}
