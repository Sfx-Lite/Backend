import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { KycDocType } from '../enums/kyc-doc-type.enum';
import { KycSubmissionStatus } from '../enums/kyc-submission-status.enum';

export class CreateKycSubmissionDto {
  @ApiProperty({
    enum: KycDocType,
    example: KycDocType.PASSPORT,
    description: 'The type of identity document being submitted.',
  })
  @IsEnum(KycDocType, {
    message: 'docType must be either passport or national_id',
  })
  docType!: KycDocType;
}

export class ListKycSubmissionsQueryDto {
  @ApiPropertyOptional({
    enum: KycSubmissionStatus,
    example: KycSubmissionStatus.PENDING,
    description:
      'Filter the review queue by submission status. Omit to return all ' +
      'submissions (oldest first). One of: pending, under_review, approved, rejected.',
  })
  @IsOptional()
  @IsEnum(KycSubmissionStatus, {
    message: 'status must be one of: pending, under_review, approved, rejected',
  })
  status?: KycSubmissionStatus;
}

const REVIEW_OUTCOMES = [
  KycSubmissionStatus.APPROVED,
  KycSubmissionStatus.REJECTED,
] as const;

export class ReviewKycSubmissionDto {
  @ApiProperty({
    enum: REVIEW_OUTCOMES,
    example: KycSubmissionStatus.APPROVED,
    description:
      'The review decision. Must be either "approved" or "rejected".',
  })
  @IsEnum(KycSubmissionStatus)
  @IsIn(REVIEW_OUTCOMES, {
    message: 'status must be either approved or rejected',
  })
  status!: KycSubmissionStatus.APPROVED | KycSubmissionStatus.REJECTED;

  @ApiPropertyOptional({
    example: 'Document photo is blurry and unreadable.',
    maxLength: 500,
    description:
      'Why the submission was rejected. Required when status is "rejected"; ' +
      'must be omitted when approving.',
  })
  @ValidateIf(
    (dto: ReviewKycSubmissionDto) =>
      dto.status === KycSubmissionStatus.REJECTED,
  )
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({
    message: 'reason is required when rejecting a KYC submission',
  })
  @MaxLength(500)
  reason?: string;
}
