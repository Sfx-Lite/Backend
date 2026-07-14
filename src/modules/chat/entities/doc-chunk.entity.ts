import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * doc_chunks — chunked knowledge-base content for AI support retrieval (RAG).
 *
 * ⚠️ pgvector: `embedding` should be a Postgres `vector(N)` column (N = your
 * embedding model's dimension, e.g. 1536). TypeORM has no native vector type,
 * so it's declared as text here to keep migrations generating cleanly. In the
 * generated migration, change the column to `vector(1536)` and ensure the
 * extension exists:
 *     CREATE EXTENSION IF NOT EXISTS vector;
 *     ALTER TABLE doc_chunks ALTER COLUMN embedding TYPE vector(1536);
 * Then add an ivfflat/hnsw index for similarity search.
 */
@Entity('doc_chunks')
export class DocChunk extends BaseEntity {
  @Column({ nullable: true })
  source?: string | null;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'pgvector: convert to vector(1536) in the migration',
  })
  embedding?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;
}
