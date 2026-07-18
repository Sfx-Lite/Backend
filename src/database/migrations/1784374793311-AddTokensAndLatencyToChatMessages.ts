import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokensAndLatencyToChatMessages1784374793311 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
    ALTER TABLE "chat_messages"
    ADD COLUMN "tokens" integer,
    ADD COLUMN "latency_ms" integer
  `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
    ALTER TABLE "chat_messages"
    DROP COLUMN "latency_ms",
    DROP COLUMN "tokens"
  `);
  }
}
