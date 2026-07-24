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
import { User } from '../users/entities/user.entity';
import { ReviewKycSubmissionDto } from './dto/kyc.dto';
import { KycSubmission } from './entities/kyc-submission.entity';
import { KycSubmissionStatus } from './enums/kyc-submission-status.enum';
import { assertValidKycStatusTransition } from './utils/kyc-status-machine';

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    @InjectRepository(KycSubmission)
    private readonly submissions: Repository<KycSubmission>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly emailService: EmailService,
  ) {}

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

    await this.sendStatusNotification(updatedSubmission);

    const message =
      dto.status === KycSubmissionStatus.APPROVED
        ? 'KYC submission approved successfully'
        : 'KYC submission rejected successfully';

    return sendResponse(updatedSubmission, message);
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
