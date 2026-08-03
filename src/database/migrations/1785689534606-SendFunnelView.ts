import { MigrationInterface, QueryRunner } from "typeorm";

export class SendFunnelView1785689534606 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      CREATE VIEW v_signup_kyc_send_funnel AS
      WITH signups AS (
        SELECT DISTINCT user_id FROM analytics_events WHERE event_name = 'signup_completed'
      ),
      kyc AS (
        SELECT DISTINCT user_id FROM analytics_events WHERE event_name = 'kyc_submitted'
      ),
      first_tx AS (
        SELECT DISTINCT user_id FROM analytics_events WHERE event_name = 'send_completed'
      )
      SELECT
        (SELECT COUNT(*) FROM signups) AS total_signups,
        (SELECT COUNT(*) FROM kyc) AS completed_kyc,
        (SELECT COUNT(*) FROM first_tx) AS completed_first_tx,
        ROUND(
          100.0 * (SELECT COUNT(*) FROM kyc) / NULLIF((SELECT COUNT(*) FROM signups), 0), 1
        ) AS signup_to_kyc_rate_pct,
        ROUND(
          100.0 * (SELECT COUNT(*) FROM first_tx) / NULLIF((SELECT COUNT(*) FROM kyc), 0), 1
        ) AS kyc_to_first_tx_rate_pct,
        ROUND(
          100.0 * (SELECT COUNT(*) FROM first_tx) / NULLIF((SELECT COUNT(*) FROM signups), 0), 1
        ) AS signup_to_first_tx_rate_pct;
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP VIEW v_signup_kyc_send_funnel;');
    }

}
