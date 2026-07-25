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
import { UploadsService } from '../uploads/uploads.service';
import { User } from '../users/entities/user.entity';
import { KycStatus } from '../users/enums/kyc-status.enum';
import { CreateKycSubmissionDto, ReviewKycSubmissionDto } from './dto/kyc.dto';
import { KycSubmission } from './entities/kyc-submission.entity';
import { KycSubmissionFiles } from './kyc.types';
import { KycSubmissionStatus } from './enums/kyc-submission-status.enum';
import { assertValidKycStatusTransition } from './utils/kyc-status-machine';
import { CreateKycSubmissionDto } from './dto/create-kyc-submission.dto';
import { UploadsService } from '../uploads/uploads.service';

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
) {}

async submitKyc(
  userId: string,
  dto: CreateKycSubmissionDto,
  document: Express.Multer.File,
  selfie: Express.Multer.File,
) {
  const documentUpload = await this.uploadsService.uploadImage(
    document,
    'kyc/documents',
  );

  const selfieUpload = await this.uploadsService.uploadImage(
    selfie,
    'kyc/selfies',
  );

  const submission = this.submissions.create({
    userId,
    docType: dto.docType,
    docUrl: documentUpload.url,
    selfieUrl: selfieUpload.url,
    status: KycSubmissionStatus.PENDING,
  });

  const savedSubmission = await this.submissions.save(submission);

  return sendResponse(
    savedSubmission,
    'KYC submission created successfully',
  );
}
  constructor(
    @InjectRepository(KycSubmission)
    private readonly submissions: Repository<KycSubmission>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly emailService: EmailService,
    private readonly uploadsService: UploadsService,
  ) {}

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
    await this.sendStatusNotification(updatedSubmission);

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

  private async sendStatusNotification(
    submission: KycSubmission,
  ): Promise<void> {
    if (
      submission.status !== KycSubmissionStatus.APPROVED &&
      submission.status !== KycSubmissionStatus.REJECTED
    ) {
      return;
    }

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
        status: submission.status,
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
        `KYC status was updated, but notification delivery failed for submission ${submission.id}: ${message}`,
      );
    }
  }
}
