import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RetrieveQueryDto {
  @IsString()
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number = 5;
}
