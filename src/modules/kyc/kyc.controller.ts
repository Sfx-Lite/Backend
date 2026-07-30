import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import {
  CreateKycSubmissionDto,
  ListKycSubmissionsQueryDto,
  ReviewKycSubmissionDto,
} from './dto/kyc.dto';
import { KycSubmissionStatus } from './enums/kyc-submission-status.enum';
import { KycService } from './kyc.service';
import type { KycSubmissionFiles } from './kyc.types';

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per file

/** A representative KYC submission row (admin view), for Swagger examples. */
const EXAMPLE_SUBMISSION = {
  id: '9b2f1c3d-4e5a-6b7c-8d9e-0f1a2b3c4d5e',
  userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  docType: 'passport',
  docUrl: 'https://res.cloudinary.com/sfx/kyc/documents/abc123.jpg',
  selfieUrl: 'https://res.cloudinary.com/sfx/kyc/selfies/def456.jpg',
  status: 'pending',
  reason: null,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: '2026-07-24T10:15:00.000Z',
  updatedAt: '2026-07-24T10:15:00.000Z',
};

@ApiTags('kyc')
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('submission')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Submit KYC documents',
    description:
      'Uploads a document image (passport or national ID) plus a selfie, ' +
      'stores the resulting Cloudinary references on a new kyc_submissions ' +
      'row, and leaves it in "pending" status for admin review. Requires a ' +
      'valid access token.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        docType: { type: 'string', enum: ['passport', 'national_id'] },
        doc: { type: 'string', format: 'binary' },
        selfie: { type: 'string', format: 'binary' },
      },
      required: ['docType', 'doc', 'selfie'],
    },
  })
  @ApiOkResponse({
    description: 'KYC submission received successfully.',
    schema: {
      example: {
        status: true,
        message: 'KYC submission received successfully',
        data: EXAMPLE_SUBMISSION,
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'doc', maxCount: 1 },
        { name: 'selfie', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_UPLOAD_SIZE_BYTES } },
    ),
  )
  submitSubmission(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateKycSubmissionDto,
    @UploadedFiles() files: KycSubmissionFiles,
  ) {
    return this.kycService.submitSubmission(userId, dto, files);
  }

  @Get('status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get my KYC status and latest submission progress',
    description:
      'Returns the caller’s overall kyc_status (unverified / pending / ' +
      'verified / rejected) plus a summary of their most recent submission ' +
      '(including the rejection reason, if any). Private document URLs are not ' +
      'exposed.',
  })
  @ApiOkResponse({
    description: 'KYC status retrieved successfully.',
    schema: {
      example: {
        status: true,
        message: 'KYC status retrieved successfully',
        data: {
          kycStatus: 'pending',
          submission: {
            id: '9b2f1c3d-4e5a-6b7c-8d9e-0f1a2b3c4d5e',
            docType: 'passport',
            status: 'under_review',
            reason: null,
            createdAt: '2026-07-24T10:15:00.000Z',
            reviewedAt: null,
          },
        },
      },
    },
  })
  getMyStatus(@CurrentUser('sub') userId: string) {
    return this.kycService.getMyStatus(userId);
  }

  @Get('submission')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List KYC submissions for review (admin only)',
    description:
      'Returns submissions oldest-first for the admin queue. Optionally ' +
      'filter by status (e.g. status=pending).',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: KycSubmissionStatus,
    example: KycSubmissionStatus.PENDING,
    description:
      'Filter the queue by submission status. Omit to return all submissions. ' +
      'One of: pending, under_review, approved, rejected.',
  })
  @ApiOkResponse({
    description: 'KYC submissions retrieved successfully.',
    schema: {
      example: {
        status: true,
        message: 'KYC submissions retrieved successfully',
        data: [EXAMPLE_SUBMISSION],
      },
    },
  })
  listSubmissions(@Query() query: ListKycSubmissionsQueryDto) {
    return this.kycService.listSubmissions(query.status);
  }

  @Get('submission/:id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'View a single KYC submission (admin only)',
    description:
      'Returns one submission with its document and selfie URLs for ' +
      'side-by-side review. Opening a pending submission marks it ' +
      '"under_review".',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    example: '9b2f1c3d-4e5a-6b7c-8d9e-0f1a2b3c4d5e',
    description: 'The KYC submission id (UUID).',
  })
  @ApiOkResponse({
    description: 'KYC submission retrieved successfully.',
    schema: {
      example: {
        status: true,
        message: 'KYC submission retrieved successfully',
        data: { ...EXAMPLE_SUBMISSION, status: 'under_review' },
      },
    },
  })
  getSubmission(@Param('id', new ParseUUIDPipe()) submissionId: string) {
    return this.kycService.getSubmissionForReview(submissionId);
  }

  @Patch('submission/:id/status')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Approve or reject a KYC submission (admin only)',
    description:
      'Only an "under_review" submission can be actioned, so the admin must ' +
      'open the detail view first. A `reason` is required when rejecting and ' +
      'must be omitted when approving.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    example: '9b2f1c3d-4e5a-6b7c-8d9e-0f1a2b3c4d5e',
    description: 'The KYC submission id (UUID).',
  })
  @ApiBody({ type: ReviewKycSubmissionDto })
  @ApiOkResponse({
    description: 'KYC submission reviewed successfully.',
    schema: {
      example: {
        status: true,
        message: 'KYC submission approved successfully',
        data: {
          ...EXAMPLE_SUBMISSION,
          status: 'approved',
          reviewedBy: 'f0e1d2c3-b4a5-6789-0123-456789abcdef',
          reviewedAt: '2026-07-24T11:00:00.000Z',
        },
      },
    },
  })
  reviewSubmission(
    @Param('id', new ParseUUIDPipe()) submissionId: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: ReviewKycSubmissionDto,
  ) {
    return this.kycService.reviewSubmission(submissionId, adminId, dto);
  }
}
