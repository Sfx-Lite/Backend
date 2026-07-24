import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Query params for GET /transactions — limit/offset paging plus optional
 * date-range and free-text filtering. Defaults to the 20 most recent. The
 * global ValidationPipe (transform + implicit conversion) casts the raw string
 * query values to numbers before validation.
 */
export class ListTransactionsQueryDto {
  @ApiPropertyOptional({
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
    description: 'How many transactions to return (1–100).',
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
    description: 'How many transactions to skip (for paging).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @ApiPropertyOptional({
    example: '2026-07-01',
    description:
      'Only transactions at/after this ISO 8601 date-time (inclusive). ' +
      'A date-only value is treated as midnight UTC.',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-07-31',
    description:
      'Only transactions at/before this ISO 8601 date-time (inclusive).',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    example: 'bob',
    description:
      'Free-text search, case-insensitive, matched against the transaction ' +
      'id, the counterparty username, and the asset (e.g. "USDC").',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
