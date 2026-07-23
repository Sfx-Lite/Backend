import { readFile } from 'fs/promises';
import * as p from '@clack/prompts';
import { RagService } from '../../modules/rag/rag.service';
import { startSpinner, reportResult } from '../ui/prompts';

export async function runIngestCommand(
  ragService: RagService,
  filePath: string,
) {
  p.intro('SFx Lite — doc ingestion');

  const spinner = startSpinner(`Reading ${filePath}`);
  const content = await readFile(filePath, 'utf-8');
  spinner.stop('File read');

  const embedSpinner = startSpinner('Chunking and embedding');
  const { inserted, skipped } = await ragService.ingest(content, filePath);
  embedSpinner.stop('Ingestion complete');

  reportResult(inserted, skipped);
}
