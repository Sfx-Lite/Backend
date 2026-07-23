import { readFile } from 'node:fs/promises';
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

  try {
    const { inserted, skipped } = await ragService.ingest(content, filePath);
    embedSpinner.stop('Ingestion complete');
    reportResult(inserted, skipped);
  } catch (error) {
    embedSpinner.stop('Ingestion failed');
    // Print the REAL error — this is what was being hidden
    p.log.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  }
}
