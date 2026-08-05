import { MigrationInterface, QueryRunner } from 'typeorm';

export class CohortAnalysisViews1785501792961 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE VIEW v_signup_cohort_kyc AS
      WITH signups AS (
        SELECT
          user_id,
          MIN(created_at) AS signup_at
        FROM analytics_events
        WHERE event_name = 'signup_completed'
        GROUP BY user_id
      ),
      kyc_completions AS (
        SELECT
          user_id,
          MIN(created_at) AS kyc_submitted_at
        FROM analytics_events
        WHERE event_name = 'kyc_submitted'
        GROUP BY user_id
      )
      SELECT
        DATE_TRUNC('week', s.signup_at)::date AS cohort_week,
        COUNT(DISTINCT s.user_id) AS cohort_size,
        COUNT(DISTINCT CASE
          WHEN k.kyc_submitted_at IS NOT NULL
           AND k.kyc_submitted_at <= s.signup_at + INTERVAL '7 days'
          THEN s.user_id
        END) AS kyc_completed_within_7d,
        ROUND(
          100.0 * COUNT(DISTINCT CASE
            WHEN k.kyc_submitted_at IS NOT NULL
             AND k.kyc_submitted_at <= s.signup_at + INTERVAL '7 days'
            THEN s.user_id
          END) / NULLIF(COUNT(DISTINCT s.user_id), 0),
          1
        ) AS kyc_completion_rate_pct
      FROM signups s
      LEFT JOIN kyc_completions k ON k.user_id = s.user_id
      GROUP BY DATE_TRUNC('week', s.signup_at)
      ORDER BY cohort_week;
    `);

    await queryRunner.query(`
      CREATE VIEW v_signup_cohort_deposit AS
      WITH signups AS (
        SELECT
          user_id,
          MIN(created_at) AS signup_at
        FROM analytics_events
        WHERE event_name = 'signup_completed'
        GROUP BY user_id
      ),
      deposit_completions AS (
        SELECT
          user_id,
          MIN(created_at) AS first_deposit_at
        FROM analytics_events
        WHERE event_name = 'deposit_address_copied'
        GROUP BY user_id
      )
      SELECT
        DATE_TRUNC('week', s.signup_at)::date AS cohort_week,
        COUNT(DISTINCT s.user_id) AS cohort_size,
        COUNT(DISTINCT CASE
          WHEN d.first_deposit_at IS NOT NULL
           AND d.first_deposit_at <= s.signup_at + INTERVAL '14 days'
          THEN s.user_id
        END) AS deposit_completed_within_14d,
        ROUND(
          100.0 * COUNT(DISTINCT CASE
            WHEN d.first_deposit_at IS NOT NULL
             AND d.first_deposit_at <= s.signup_at + INTERVAL '14 days'
            THEN s.user_id
          END) / NULLIF(COUNT(DISTINCT s.user_id), 0),
          1
        ) AS deposit_completion_rate_pct
      FROM signups s
      LEFT JOIN deposit_completions d ON d.user_id = s.user_id
      GROUP BY DATE_TRUNC('week', s.signup_at)
      ORDER BY cohort_week;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP VIEW v_signup_cohort_kyc;');
    await queryRunner.query('DROP VIEW v_signup_cohort_deposit;');
  }
}
