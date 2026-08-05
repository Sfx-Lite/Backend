import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatbotFailureRateView1785839098266 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE VIEW v_chatbot_failure_rate_by_day AS
      SELECT
        DATE(created_at) AS day,
        COUNT(*) AS total_attempts,
        COUNT(*) FILTER (WHERE status = 'success') AS successful,
        COUNT(*) FILTER (WHERE status = 'failure') AS failed,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE status = 'failure') / NULLIF(COUNT(*), 0),
          1
        ) AS failure_rate_pct
      FROM chat_messages
      WHERE role = 'assistant'
      GROUP BY DATE(created_at)
      ORDER BY day;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP VIEW v_chatbot_failure_rate_by_day;');
  }
}
