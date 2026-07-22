import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { KycSubmissionStatus } from '../enums/kyc-submission-status.enum';

const REVIEW_OUTCOMES = [
  KycSubmissionStatus.APPROVED,
  KycSubmissionStatus.REJECTED,
] as const;

export class ReviewKycSubmissionDto {
  @IsEnum(KycSubmissionStatus)
  @IsIn(REVIEW_OUTCOMES, {
    message: 'status must be either approved or rejected',
  })
  status!: KycSubmissionStatus.APPROVED | KycSubmissionStatus.REJECTED;

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
