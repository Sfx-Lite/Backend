#!/usr/bin/env node
import { NestFactory } from '@nestjs/core';
import { CliModule } from './cli.module';
import { RagService } from './modules/rag/rag.service';
import { runIngestCommand } from './cli/commands/ingest.command';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(CliModule);
  const ragService = app.get(RagService);

  const [, , command, ...args] = process.argv;

  switch (command) {
    case 'ingest':
      await runIngestCommand(ragService, args[0]);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exitCode = 1;
  }

  await app.close();
}

void bootstrap();
