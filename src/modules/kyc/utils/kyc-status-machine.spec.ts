import { BadRequestException } from '@nestjs/common';
import { KycSubmissionStatus } from '../enums/kyc-submission-status.enum';
import {
  assertValidKycStatusTransition,
  canTransitionKycStatus,
} from './kyc-status-machine';

describe('KYC status machine', () => {
  describe('canTransitionKycStatus', () => {
    it('allows pending to transition to under review', () => {
      expect(
        canTransitionKycStatus(
          KycSubmissionStatus.PENDING,
          KycSubmissionStatus.UNDER_REVIEW,
        ),
      ).toBe(true);
    });

    it('allows under review to transition to approved', () => {
      expect(
        canTransitionKycStatus(
          KycSubmissionStatus.UNDER_REVIEW,
          KycSubmissionStatus.APPROVED,
        ),
      ).toBe(true);
    });

    it('allows under review to transition to rejected', () => {
      expect(
        canTransitionKycStatus(
          KycSubmissionStatus.UNDER_REVIEW,
          KycSubmissionStatus.REJECTED,
        ),
      ).toBe(true);
    });

    it('does not allow pending to transition directly to approved', () => {
      expect(
        canTransitionKycStatus(
          KycSubmissionStatus.PENDING,
          KycSubmissionStatus.APPROVED,
        ),
      ).toBe(false);
    });

    it('does not allow pending to transition directly to rejected', () => {
      expect(
        canTransitionKycStatus(
          KycSubmissionStatus.PENDING,
          KycSubmissionStatus.REJECTED,
        ),
      ).toBe(false);
    });

    it('does not allow approved to transition to another status', () => {
      expect(
        canTransitionKycStatus(
          KycSubmissionStatus.APPROVED,
          KycSubmissionStatus.REJECTED,
        ),
      ).toBe(false);
    });

    it('does not allow rejected to transition to another status', () => {
      expect(
        canTransitionKycStatus(
          KycSubmissionStatus.REJECTED,
          KycSubmissionStatus.UNDER_REVIEW,
        ),
      ).toBe(false);
    });

    it('does not allow transitioning to the same status', () => {
      expect(
        canTransitionKycStatus(
          KycSubmissionStatus.PENDING,
          KycSubmissionStatus.PENDING,
        ),
      ).toBe(false);
    });
  });

  describe('assertValidKycStatusTransition', () => {
    it('does not throw for a valid transition', () => {
      expect(() =>
        assertValidKycStatusTransition(
          KycSubmissionStatus.PENDING,
          KycSubmissionStatus.UNDER_REVIEW,
        ),
      ).not.toThrow();
    });

    it('throws BadRequestException for an invalid transition', () => {
      expect(() =>
        assertValidKycStatusTransition(
          KycSubmissionStatus.PENDING,
          KycSubmissionStatus.APPROVED,
        ),
      ).toThrow(BadRequestException);
    });

    it('includes the statuses in the error message', () => {
      expect(() =>
        assertValidKycStatusTransition(
          KycSubmissionStatus.APPROVED,
          KycSubmissionStatus.REJECTED,
        ),
      ).toThrow('Invalid KYC status transition from "approved" to "rejected"');
    });
  });
});
