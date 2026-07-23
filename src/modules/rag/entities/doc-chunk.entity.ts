import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('doc_chunks')
export class DocChunk extends BaseEntity {
  @Column({ type: 'varchar', nullable: true })
  source?: string | null;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'pgvector vector(1024) column. TypeORM has no native vector type',
  })
  embedding?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ name: 'content_hash', type: 'varchar', nullable: true })
  contentHash?: string | null;
}
