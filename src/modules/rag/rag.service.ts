import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import { DocChunk } from './entities/doc-chunk.entity';
import { validatedEnv } from 'src/config/env.validation';

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const EMBEDDING_MODEL = 'voyage-4';
const CHUNK_TOKEN_TARGET = 500;
const CHUNK_OVERLAP_TOKENS = 50;

export interface RetrievedChunk {
  content: string;
  source: string | null;
  distance: number;
}

@Injectable()
export class RagService {
  constructor(
    @InjectRepository(DocChunk)
    private readonly docChunkRepo: Repository<DocChunk>,
  ) {}

  chunkText(content: string): string[] {
    const paragraphs = content
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    const chunks: string[] = [];
    let current: string[] = [];
    let currentTokens = 0;

    const estimateTokens = (text: string) => Math.ceil(text.length / 4);

    for (const para of paragraphs) {
      const paraTokens = estimateTokens(para);

      if (
        currentTokens + paraTokens > CHUNK_TOKEN_TARGET &&
        current.length > 0
      ) {
        chunks.push(current.join('\n\n'));

        const overlapText = current
          .join('\n\n')
          .slice(-CHUNK_OVERLAP_TOKENS * 4);
        current = [overlapText];
        currentTokens = estimateTokens(overlapText);
      }

      current.push(para);
      currentTokens += paraTokens;
    }

    if (current.length > 0) chunks.push(current.join('\n\n'));

    return chunks;
  }

  private async embedTexts(
    texts: string[],
    inputType: 'document' | 'query',
  ): Promise<number[][]> {
    const apiKey = validatedEnv.VOYAGE_API_KEY;
    if (!apiKey) throw new Error('VOYAGE_API_KEY is not set');

    const response = await fetch(VOYAGE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts,
        input_type: inputType,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Voyage embedding request failed: ${response.status} ${errText}`,
      );
    }

    const data = (await response.json()) as { data: { embedding: number[] }[] };
    return data.data.map((d) => d.embedding);
  }

  private toVectorLiteral(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  async ingest(
    content: string,
    source: string,
  ): Promise<{ inserted: number; skipped: number }> {
    const chunks = this.chunkText(content);
    let inserted = 0;
    let skipped = 0;

    const embeddings = await this.embedTexts(chunks, 'document');

    for (let i = 0; i < chunks.length; i++) {
      const contentHash = this.hashContent(chunks[i]);

      const existing = await this.docChunkRepo.findOne({
        where: { contentHash, source },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const vectorLiteral = this.toVectorLiteral(embeddings[i]);

      await this.docChunkRepo.query(
        `INSERT INTO doc_chunks (source, content, embedding, content_hash)
   VALUES ($1, $2, $3, $4)`,
        [source, chunks[i], vectorLiteral, contentHash],
      );
      inserted++;
    }

    return { inserted, skipped };
  }

  async retrieve(query: string, topK = 5): Promise<RetrievedChunk[]> {
    const [queryEmbedding] = await this.embedTexts([query], 'query');
    const vectorLiteral = this.toVectorLiteral(queryEmbedding);

    const rows: { content: string; source: string | null; distance: number }[] =
      await this.docChunkRepo.query(
        `SELECT content, source, embedding <=> $1::vector AS distance
       FROM doc_chunks
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
        [vectorLiteral, topK],
      );

    return rows;
  }
}
