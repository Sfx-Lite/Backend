import { MigrationInterface, QueryRunner } from 'typeorm';

export class KycReviewSlaViews1785175174303 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE VIEW v_kyc_review_sla AS
            SELECT
            id AS submission_id,
            user_id,
            doc_type,
            status,
            reason,
            reviewed_by,
            created_at,
            reviewed_at,
            EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 3600 AS review_duration_hours
            FROM kyc_submissions
            WHERE reviewed_at IS NOT NULL
            ORDER BY reviewed_at;
        `);

    await queryRunner.query(`
        CREATE VIEW v_kyc_review_sla_daily AS
        SELECT
            DATE(reviewed_at) AS day,
            COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
            COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
            ROUND(AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 3600)::numeric, 2) AS avg_review_hours
        FROM kyc_submissions
        WHERE reviewed_at IS NOT NULL
        GROUP BY DATE(reviewed_at)
        ORDER BY day;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW v_kyc_review_sla;`);
    await queryRunner.query(`DROP VIEW v_kyc_review_sla_daily;`);
  }
}
