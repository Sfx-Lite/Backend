import { MigrationInterface, QueryRunner } from 'typeorm';

export class DashboardV1Views1785112562043 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
    CREATE VIEW v_signup_funnel AS
    SELECT
      DATE(created_at) AS day,
      properties->>'method' AS method,
      COUNT(*) AS signup_count
    FROM analytics_events
    WHERE event_name = 'signup_completed'
    GROUP BY DATE(created_at), properties->>'method'
    ORDER BY day;
  `);

    await queryRunner.query(`
    CREATE VIEW v_kyc_funnel AS
    SELECT
        DATE(created_at) AS day,
        COUNT(*) FILTER (WHERE event_name = 'kyc_submission_started') AS submission_started,
        COUNT(*) FILTER (WHERE event_name = 'kyc_document_uploaded') AS document_uploaded,
        COUNT(*) FILTER (WHERE event_name = 'kyc_submitted') AS submitted
    FROM analytics_events
    WHERE event_name IN ('kyc_submission_started', 'kyc_document_uploaded', 'kyc_submitted')
    GROUP BY DATE(created_at)
    ORDER BY day;
    `);

    await queryRunner.query(`
    CREATE VIEW v_deposit_funnel AS
    SELECT
        DATE(created_at) AS day,
        COUNT(*) FILTER (WHERE event_name = 'deposit_method_selected') AS method_selected,
        COUNT(*) FILTER (WHERE event_name = 'deposit_address_viewed') AS address_viewed,
        COUNT(*) FILTER (WHERE event_name = 'deposit_address_copied') AS address_copied
    FROM analytics_events
    WHERE event_name IN ('deposit_method_selected', 'deposit_address_viewed', 'deposit_address_copied')
    GROUP BY DATE(created_at)
    ORDER BY day;
    `);

    await queryRunner.query(`
    CREATE VIEW v_event_counts_by_type AS
    SELECT
        event_name,
        actor_type,
        COUNT(*) AS event_count
    FROM analytics_events
    GROUP BY event_name, actor_type
    ORDER BY event_count DESC;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW v_signup_funnel;`);
    await queryRunner.query(`DROP VIEW v_kyc_funnel;`);
    await queryRunner.query(`DROP VIEW v_deposit_funnel;`);
    await queryRunner.query(`DROP VIEW v_event_counts_by_type;`);
  }
}
