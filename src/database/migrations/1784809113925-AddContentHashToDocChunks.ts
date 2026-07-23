import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContentHashToDocChunks1784809113925 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
    ALTER TABLE "doc_chunks" ADD COLUMN "content_hash" character varying
  `);

    // composite index — your idempotency check queries on both columns together
    await queryRunner.query(`
    CREATE INDEX "IDX_doc_chunks_content_hash_source"
    ON "doc_chunks" ("content_hash", "source")
  `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_doc_chunks_content_hash_source"`);
    await queryRunner.query(
      `ALTER TABLE "doc_chunks" DROP COLUMN "content_hash"`,
    );
  }
}
