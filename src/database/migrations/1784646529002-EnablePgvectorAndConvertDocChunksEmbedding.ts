import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnablePgvectorAndConvertDocChunksEmbedding1784646529002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await queryRunner.query(`
    ALTER TABLE "doc_chunks"
    ALTER COLUMN "embedding" TYPE vector(1536)
    USING embedding::vector
  `);

    await queryRunner.query(`
    CREATE INDEX "IDX_doc_chunks_embedding" ON "doc_chunks"
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
  `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_doc_chunks_embedding"`);
    await queryRunner.query(`
    ALTER TABLE "doc_chunks"
    ALTER COLUMN "embedding" TYPE text
  `);
  }
}
