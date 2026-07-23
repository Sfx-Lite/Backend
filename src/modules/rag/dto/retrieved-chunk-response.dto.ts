import { ApiProperty } from '@nestjs/swagger';

export class RetrievedChunkResponseDto {
  @ApiProperty({
    description: 'The matched chunk of text from the knowledge base',
  })
  content!: string;

  @ApiProperty({
    description: 'Source identifier the chunk was ingested from',
    nullable: true,
  })
  source!: string | null;

  @ApiProperty({
    description:
      'Cosine distance to the query embedding — lower means more similar',
  })
  distance!: number;
}
