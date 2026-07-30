import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { TransactionStatus } from '../enums/transaction-status.enum';
import { TransactionType } from '../enums/transaction-type.enum';

/**
 * Query params for GET /transactions/list (admin) — the platform-wide
 * transactions monitor. limit/offset paging plus optional type / status /
 * user / date-range / free-text filters. Distinct from the user-facing history
 * DTO: this one is not scoped to the caller and can filter by any userId.
 */
export class ListAllTransactionsQueryDto {
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
    enum: TransactionType,
    description: 'Only transactions of this type.',
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({
    enum: TransactionStatus,
    description: 'Only transactions in this status.',
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only transactions this user sent or received.',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Only transactions at/after this ISO 8601 date-time (inclusive).',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-07-31',
    description: 'Only transactions at/before this ISO 8601 date-time (inclusive).',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    example: '0x9a8b…',
    description:
      'Free-text search, case-insensitive, matched against the transaction ' +
      'id, asset, tx hash, and external address.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
