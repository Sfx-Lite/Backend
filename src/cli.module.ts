import { Module } from '@nestjs/common';
import { RagModule } from './modules/rag/rag.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [DatabaseModule, RagModule],
})
export class CliModule {}
