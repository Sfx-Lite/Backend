import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiBody({ type: RetrieveQueryDto })
  @ApiOkResponse({
    description: 'Chunks ordered by similarity, closest first.',
    schema: {
      example: {
        status: true,
        message: 'Success',
        data: [
          {
            content:
              'You can send money once your identity (KYC) has been verified.',
            source: 'faq/kyc.md',
            distance: 0.1234,
          },
          {
            content:
              'Deposits and receiving funds are available before verification.',
            source: 'faq/wallet.md',
            distance: 0.2451,
          },
        ],
      },
    },
  })
  async retrieve(
    @Body() dto: RetrieveQueryDto,
  ): Promise<RetrievedChunkResponseDto[]> {
    return this.ragService.retrieve(dto.query, dto.topK);
  }
}
