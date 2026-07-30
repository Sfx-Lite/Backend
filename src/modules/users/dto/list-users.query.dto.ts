import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { KycStatus } from '../enums/kyc-status.enum';
import { UserRole } from '../enums/user-role.enum';

/**
 * Query params for GET /users (admin) — limit/offset paging plus optional
 * role / kycStatus / suspended filters and free-text search. Defaults to the
 * 20 most recent. The global ValidationPipe (transform + implicit conversion)
 * casts raw string query values before validation.
 */
export class ListUsersQueryDto {
  @ApiPropertyOptional({
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
    description: 'How many users to return (1–100).',
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
    description: 'How many users to skip (for paging).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @ApiPropertyOptional({
    example: 'john',
    description:
      'Free-text search, case-insensitive, matched against username and email.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Only users holding this role.',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    enum: KycStatus,
    description: 'Only users with this KYC status.',
  })
  @IsOptional()
  @IsEnum(KycStatus)
  kycStatus?: KycStatus;

  @ApiPropertyOptional({
    example: 'true',
    description:
      'Filter by suspension state — "true" returns only suspended accounts, ' +
      '"false" only active ones. Omit for all users.',
  })
  @IsOptional()
  @IsBooleanString()
  suspended?: string;
}
