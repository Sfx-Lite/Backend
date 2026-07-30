import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

/**
 * Query params for GET /admin/revenue — an optional created_at date range. Omit
 * both for all-time figures.
 */
export class RevenueQueryDto {
  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Count from this ISO 8601 date-time (inclusive).',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-07-31',
    description: 'Count up to this ISO 8601 date-time (inclusive).',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
