import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { sendResponse } from '../../common/utils/response.util';
import { EmailService } from '../email/email.service';
import { buildKycStatusEmail } from '../email/templates/kyc-status-email.template';
import { NotificationsService } from '../notifications/notifications.service';
import { UploadsService } from '../uploads/uploads.service';
import { User } from '../users/entities/user.entity';
import { KycStatus } from '../users/enums/kyc-status.enum';
import { CreateKycSubmissionDto, ReviewKycSubmissionDto } from './dto/kyc.dto';
import { KycSubmission } from './entities/kyc-submission.entity';
import { KycSubmissionStatus } from './enums/kyc-submission-status.enum';
import { KycSubmissionFiles } from './kyc.types';
import { assertValidKycStatusTransition } from './utils/kyc-status-machine';

const IN_PROGRESS_STATUSES: readonly KycSubmissionStatus[] = [
  KycSubmissionStatus.PENDING,
  KycSubmissionStatus.UNDER_REVIEW,
];

// Maps a kyc_submissions.status to the users.kyc_status it should drive.
// Only terminal/queued outcomes are represented — a submission status with
// no entry here leaves the user's kycStatus untouched.
const USER_KYC_STATUS_BY_SUBMISSION_STATUS: Partial<
  Record<KycSubmissionStatus, KycStatus>
> = {
  [KycSubmissionStatus.PENDING]: KycStatus.PENDING,
  [KycSubmissionStatus.UNDER_REVIEW]: KycStatus.PENDING,
  [KycSubmissionStatus.APPROVED]: KycStatus.VERIFIED,
  [KycSubmissionStatus.REJECTED]: KycStatus.REJECTED,
};

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    @InjectRepository(KycSubmission)
    private readonly submissions: Repository<KycSubmission>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly emailService: EmailService,
    private readonly uploadsService: UploadsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * User-facing submission: uploads the document + selfie to private storage
   * and opens a new kyc_submissions row in `pending`. A user can only have one
   * submission in flight at a time (pending or under_review); once a previous
   * one is approved or rejected they may submit again (resubmit).
   */
  async submitSubmission(
    userId: string,
    dto: CreateKycSubmissionDto,
    files: KycSubmissionFiles,
  ) {
    const docFile = files?.doc?.[0];
    const selfieFile = files?.selfie?.[0];

    if (!docFile || !selfieFile) {
      throw new BadRequestException(
        'Both a document image (doc) and a selfie image (selfie) are required',
      );
    }

    if (
      !docFile.mimetype.startsWith('image/') ||
      !selfieFile.mimetype.startsWith('image/')
    ) {
      throw new BadRequestException('doc and selfie must both be images');
    }

    const existing = await this.submissions.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    if (existing && IN_PROGRESS_STATUSES.includes(existing.status)) {
      throw new BadRequestException(
        'You already have a KYC submission awaiting review',
      );
    }

    const [doc, selfie] = await Promise.all([
      this.uploadsService.uploadImage(docFile, 'kyc/documents'),
      this.uploadsService.uploadImage(selfieFile, 'kyc/selfies'),
    ]);

    const submission = this.submissions.create({
      userId,
      docType: dto.docType,
      docUrl: doc.url,
      selfieUrl: selfie.url,
      status: KycSubmissionStatus.PENDING,
    });

    const saved = await this.submissions.save(submission);

    await this.syncUserKycStatus(saved.userId, saved.status);

    return sendResponse(saved, 'KYC submission received successfully');
  }

  /**
   * Admin queue: submissions oldest-first so the longest-waiting user is
   * reviewed next. Optionally filtered by status (e.g. only `pending`).
   */
  async listSubmissions(status?: KycSubmissionStatus) {
    const submissions = await this.submissions.find({
      where: status ? { status } : {},
      order: { createdAt: 'ASC' },
    });

    return sendResponse(submissions, 'KYC submissions retrieved successfully');
  }

  /**
   * User-facing status: the caller's overall kyc_status plus a summary of their
   * latest submission (progress + rejection reason on resubmit), without
   * exposing the private document/selfie URLs.
   */
  async getMyStatus(userId: string) {
    const [user, submission] = await Promise.all([
      this.users.findOne({
        where: { id: userId },
        select: { id: true, kycStatus: true },
      }),
      this.submissions.findOne({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
    ]);

    return sendResponse(
      {
        kycStatus: user?.kycStatus ?? KycStatus.UNVERIFIED,
        submission: submission
          ? {
              id: submission.id,
              docType: submission.docType,
              status: submission.status,
              reason: submission.reason,
              createdAt: submission.createdAt,
              reviewedAt: submission.reviewedAt,
            }
          : null,
      },
      'KYC status retrieved successfully',
    );
  }

  /**
   * Admin detail view. Opening a `pending` submission moves it to
   * `under_review` — this is the one legal path to that state, and it records
   * that an admin has picked the submission up before deciding on it.
   */
  async getSubmissionForReview(submissionId: string) {
    const submission = await this.submissions.findOne({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new NotFoundException('KYC submission not found');
    }

    if (submission.status === KycSubmissionStatus.PENDING) {
      assertValidKycStatusTransition(
        submission.status,
        KycSubmissionStatus.UNDER_REVIEW,
      );

      submission.status = KycSubmissionStatus.UNDER_REVIEW;
      await this.submissions.save(submission);
      await this.syncUserKycStatus(submission.userId, submission.status);
    }

    return sendResponse(submission, 'KYC submission retrieved successfully');
  }

  /**
   * Admin decision: approve or reject a submission that is under review. The
   * status machine enforces that only an `under_review` submission can be
   * actioned, so an admin must open the detail view (which claims it) first.
   */
  async reviewSubmission(
    submissionId: string,
    adminId: string,
    dto: ReviewKycSubmissionDto,
  ) {
    const submission = await this.submissions.findOne({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new NotFoundException('KYC submission not found');
    }

    assertValidKycStatusTransition(submission.status, dto.status);

    if (
      dto.status === KycSubmissionStatus.APPROVED &&
      dto.reason !== undefined
    ) {
      throw new BadRequestException(
        'A rejection reason cannot be provided when approving a KYC submission',
      );
    }

    submission.status = dto.status;
    submission.reviewedBy = adminId;
    submission.reviewedAt = new Date();
    submission.reason =
      dto.status === KycSubmissionStatus.REJECTED ? dto.reason?.trim() : null;

    const updatedSubmission = await this.submissions.save(submission);

    await this.syncUserKycStatus(
      updatedSubmission.userId,
      updatedSubmission.status,
    );
    await this.notifyDecision(updatedSubmission);

    const message =
      dto.status === KycSubmissionStatus.APPROVED
        ? 'KYC submission approved successfully'
        : 'KYC submission rejected successfully';

    return sendResponse(updatedSubmission, message);
  }

  /**
   * Keeps users.kyc_status aligned with the kyc_submissions status that
   * drives it. Runs as a plain local write (no try/catch) — unlike email
   * delivery, a failure here should surface and fail the request, since a
   * submission left out of sync with the user's profile is a data bug.
   */
  private async syncUserKycStatus(
    userId: string,
    submissionStatus: KycSubmissionStatus,
  ): Promise<void> {
    const kycStatus = USER_KYC_STATUS_BY_SUBMISSION_STATUS[submissionStatus];

    if (!kycStatus) {
      return;
    }

    const result = await this.users.update(userId, { kycStatus });

    if (!result.affected) {
      this.logger.error(
        `Unable to sync kycStatus: user ${userId} was not found`,
      );
    }
  }

  /**
   * Fires the user notifications for a KYC decision: an in-app notification
   * (so it shows in the notification center) and an email. Both are best
   * effort — a delivery failure is logged but never rolls back the decision,
   * which is already committed to the database.
   */
  private async notifyDecision(submission: KycSubmission): Promise<void> {
    if (
      submission.status !== KycSubmissionStatus.APPROVED &&
      submission.status !== KycSubmissionStatus.REJECTED
    ) {
      return;
    }

    await this.sendInAppNotification(submission);
    await this.sendStatusEmail(submission);
  }

  private async sendInAppNotification(
    submission: KycSubmission,
  ): Promise<void> {
    const approved = submission.status === KycSubmissionStatus.APPROVED;

    try {
      await this.notificationsService.create({
        userId: submission.userId,
        type: 'kyc',
        title: approved
          ? 'KYC verification approved'
          : 'KYC verification not approved',
        body: approved
          ? 'Your identity has been verified. Sending and withdrawals are now unlocked.'
          : `Your identity verification was not approved.${
              submission.reason ? ` Reason: ${submission.reason}` : ''
            } You can submit a new verification request.`,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown notification error';

      this.logger.error(
        `KYC status was updated, but the in-app notification failed for submission ${submission.id}: ${message}`,
      );
    }
  }

  private async sendStatusEmail(submission: KycSubmission): Promise<void> {
    try {
      const user = await this.users.findOne({
        where: { id: submission.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      if (!user) {
        this.logger.error(
          `Unable to send KYC notification: user ${submission.userId} was not found`,
        );

        return;
      }

      const recipientName = [user.firstName, user.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();

      const template = buildKycStatusEmail({
        status: submission.status as
          KycSubmissionStatus.APPROVED | KycSubmissionStatus.REJECTED,
        recipientName,
        reason: submission.reason,
      });

      await this.emailService.send({
        to: user.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown notification error';

      this.logger.error(
        `KYC status was updated, but email delivery failed for submission ${submission.id}: ${message}`,
      );
    }
  }
}
