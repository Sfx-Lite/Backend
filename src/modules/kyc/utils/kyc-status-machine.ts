import { BadRequestException } from '@nestjs/common';
import { KycSubmissionStatus } from '../enums/kyc-submission-status.enum';

const ALLOWED_KYC_STATUS_TRANSITIONS: Readonly<
  Record<KycSubmissionStatus, readonly KycSubmissionStatus[]>
> = {
  [KycSubmissionStatus.PENDING]: [KycSubmissionStatus.UNDER_REVIEW],

  [KycSubmissionStatus.UNDER_REVIEW]: [
    KycSubmissionStatus.APPROVED,
    KycSubmissionStatus.REJECTED,
  ],

  [KycSubmissionStatus.APPROVED]: [],

  [KycSubmissionStatus.REJECTED]: [],
};

export function canTransitionKycStatus(
  currentStatus: KycSubmissionStatus,
  nextStatus: KycSubmissionStatus,
): boolean {
  return ALLOWED_KYC_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function assertValidKycStatusTransition(
  currentStatus: KycSubmissionStatus,
  nextStatus: KycSubmissionStatus,
): void {
  if (!canTransitionKycStatus(currentStatus, nextStatus)) {
    throw new BadRequestException(
      `Invalid KYC status transition from "${currentStatus}" to "${nextStatus}"`,
    );
  }
}
