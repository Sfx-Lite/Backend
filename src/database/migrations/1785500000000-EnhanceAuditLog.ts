import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Broadens audit_log from an admin-only trail into a platform-wide one:
 *  - admin_id → actor_id, made nullable (users and system jobs log too).
 *  - entity made nullable (not every event targets a specific record).
 *  - adds `category` (owning domain / filter slug) and `level` (severity).
 */
export class EnhanceAuditLog1785500000000 implements MigrationInterface {
  name = 'EnhanceAuditLog1785500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // admin_id → actor_id, nullable. Renaming keeps the existing index valid.
    await queryRunner.query(
      `ALTER TABLE "audit_log" RENAME COLUMN "admin_id" TO "actor_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_log" ALTER COLUMN "actor_id" DROP NOT NULL`,
    );

    // entity is now optional.
    await queryRunner.query(
      `ALTER TABLE "audit_log" ALTER COLUMN "entity" DROP NOT NULL`,
    );

    // category enum + column.
    await queryRunner.query(
      `CREATE TYPE "public"."audit_log_category_enum" AS ENUM('user', 'admin', 'transaction', 'kyc', 'auth', 'wallet', 'system')`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_log" ADD "category" "public"."audit_log_category_enum" NOT NULL DEFAULT 'system'`,
    );

    // level enum + column.
    await queryRunner.query(
      `CREATE TYPE "public"."audit_log_level_enum" AS ENUM('normal', 'medium', 'high')`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_log" ADD "level" "public"."audit_log_level_enum" NOT NULL DEFAULT 'normal'`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_category" ON "audit_log" ("category")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_level" ON "audit_log" ("level")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_log_level"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_log_category"`);
    await queryRunner.query(`ALTER TABLE "audit_log" DROP COLUMN "level"`);
    await queryRunner.query(`DROP TYPE "public"."audit_log_level_enum"`);
    await queryRunner.query(`ALTER TABLE "audit_log" DROP COLUMN "category"`);
    await queryRunner.query(`DROP TYPE "public"."audit_log_category_enum"`);

    // Restore NOT NULL constraints and the original column name. Existing rows
    // must satisfy the constraints; this is a dev/testnet migration.
    await queryRunner.query(
      `ALTER TABLE "audit_log" ALTER COLUMN "entity" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_log" ALTER COLUMN "actor_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_log" RENAME COLUMN "actor_id" TO "admin_id"`,
    );
  }
}
