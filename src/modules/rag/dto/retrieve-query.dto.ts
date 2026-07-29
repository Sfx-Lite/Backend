import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RetrieveQueryDto {
  @ApiProperty({
    description: 'Natural-language question to search the knowledge base for',
    example: "Why can't I send money yet?",
  })
  @IsString()
  query!: string;

  @ApiPropertyOptional({
    description: 'Number of top matching chunks to return',
    default: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number = 5;
}
