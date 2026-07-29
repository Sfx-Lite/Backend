import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RagService } from './rag.service';
import { RetrieveQueryDto } from './dto/retrieve-query.dto';
import { RetrievedChunkResponseDto } from './dto/retrieved-chunk-response.dto';

@ApiTags('RAG')
@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('retrieve')
  @ApiOperation({
    summary: 'Retrieve relevant knowledge-base chunks for a query',
    description:
      'Embeds the given query text and returns the top-k most similar doc_chunks via pgvector cosine similarity search.',
  })
  @ApiOkResponse({
    description: 'Chunks ordered by similarity, closest first.',
    type: RetrievedChunkResponseDto,
    isArray: true,
  })
  async retrieve(
    @Body() dto: RetrieveQueryDto,
  ): Promise<RetrievedChunkResponseDto[]> {
    return this.ragService.retrieve(dto.query, dto.topK);
  }
}
