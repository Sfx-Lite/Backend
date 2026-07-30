import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import { AuditCategory } from '../enums/audit-category.enum';
import { AuditLevel } from '../enums/audit-level.enum';

/**
 * Query params for GET /audit-logs (admin) — paging plus optional
 * category / level / actor / entity filters and a created_at date range.
 */
export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
    description: 'How many audit rows to return (1–100).',
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
    description: 'How many rows to skip (for paging).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @ApiPropertyOptional({
    enum: AuditCategory,
    description: 'Only events in this domain (the filter slug).',
  })
  @IsOptional()
  @IsEnum(AuditCategory)
  category?: AuditCategory;

  @ApiPropertyOptional({
    enum: AuditLevel,
    description: 'Only events at this severity.',
  })
  @IsOptional()
  @IsEnum(AuditLevel)
  level?: AuditLevel;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only events performed by this actor (admin or user id).',
  })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({
    example: 'kyc_submission',
    description: 'Only events acting on this kind of entity.',
  })
  @IsOptional()
  entity?: string;

  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Only events at/after this ISO 8601 date-time (inclusive).',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-07-31',
    description: 'Only events at/before this ISO 8601 date-time (inclusive).',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
