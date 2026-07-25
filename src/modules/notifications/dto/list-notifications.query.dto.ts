import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Query params for GET /notifications — limit/offset paging plus an optional
 * unread-only filter. Mirrors ListTransactionsQueryDto's paging shape so the
 * frontend can reuse one paging pattern across both endpoints.
 */
export class ListNotificationsQueryDto {
  @ApiPropertyOptional({
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
    description: 'How many notifications to return (1–100).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    minimum: 0,
    description: 'How many notifications to skip (for paging).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @ApiPropertyOptional({
    example: true,
    description: 'If true, only return notifications with no readAt yet.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;
}