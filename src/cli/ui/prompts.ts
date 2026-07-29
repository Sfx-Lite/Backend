import * as p from '@clack/prompts';

export function startSpinner(message: string) {
  const spinner = p.spinner();
  spinner.start(message);
  return spinner;
}

export function reportResult(inserted: number, skipped: number) {
  p.outro(`Done — inserted ${inserted} chunks, skipped ${skipped} duplicates.`);
}
