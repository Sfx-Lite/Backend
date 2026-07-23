import { Body, Controller, Post } from '@nestjs/common';
import { RagService } from './rag.service';
import { RetrieveQueryDto } from './dto/retrieve-query.dto';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('retrieve')
  async retrieve(@Body() dto: RetrieveQueryDto) {
    return this.ragService.retrieve(dto.query, dto.topK);
  }
}
