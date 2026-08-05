import { MigrationInterface, QueryRunner } from 'typeorm';

export class CohortFirstTxView1785690695846 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE VIEW v_signup_cohort_first_tx AS
      WITH signups AS (
        SELECT
          user_id,
          MIN(created_at) AS signup_at
        FROM analytics_events
        WHERE event_name = 'signup_completed'
        GROUP BY user_id
      ),
      first_tx_completions AS (
        SELECT
          user_id,
          MIN(created_at) AS first_tx_at
        FROM analytics_events
        WHERE event_name = 'send_completed'
        GROUP BY user_id
      )
      SELECT
        DATE_TRUNC('week', s.signup_at)::date AS cohort_week,
        COUNT(DISTINCT s.user_id) AS cohort_size,
        COUNT(DISTINCT CASE
          WHEN t.first_tx_at IS NOT NULL
           AND t.first_tx_at <= s.signup_at + INTERVAL '30 days'
          THEN s.user_id
        END) AS first_tx_completed_within_30d,
        ROUND(
          100.0 * COUNT(DISTINCT CASE
            WHEN t.first_tx_at IS NOT NULL
             AND t.first_tx_at <= s.signup_at + INTERVAL '30 days'
            THEN s.user_id
          END) / NULLIF(COUNT(DISTINCT s.user_id), 0),
          1
        ) AS first_tx_completion_rate_pct
      FROM signups s
      LEFT JOIN first_tx_completions t ON t.user_id = s.user_id
      GROUP BY DATE_TRUNC('week', s.signup_at)
      ORDER BY cohort_week;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP VIEW v_signup_cohort_first_tx;');
  }
}
