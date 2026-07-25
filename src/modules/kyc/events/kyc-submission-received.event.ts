export const KYC_SUBMISSION_RECEIVED_EVENT = 'kyc.submission.received';

export interface KycSubmissionReceivedEvent {
  submissionId: string;
  userId: string;
  submittedAt: Date;
}
