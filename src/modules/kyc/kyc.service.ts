import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { sendResponse } from '../../common/utils/response.util';
import { ReviewKycSubmissionDto } from './dto/review-kyc-submission.dto';
import { KycSubmission } from './entities/kyc-submission.entity';
import { KycSubmissionStatus } from './enums/kyc-submission-status.enum';
import { assertValidKycStatusTransition } from './utils/kyc-status-machine';

@Injectable()
export class KycService {
  constructor(
    @InjectRepository(KycSubmission)
    private readonly submissions: Repository<KycSubmission>,
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

    const message =
      dto.status === KycSubmissionStatus.APPROVED
        ? 'KYC submission approved successfully'
        : 'KYC submission rejected successfully';

    return sendResponse(updatedSubmission, message);
  }
}
