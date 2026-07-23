import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocChunk } from './entities/doc-chunk.entity';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DocChunk])],
  providers: [RagService],
  controllers: [RagController],
  exports: [RagService],
})
export class RagModule {}
