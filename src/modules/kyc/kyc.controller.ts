import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
  ParseFilePipe,
  FileTypeValidator,
  MaxFileSizeValidator,
} from '@nestjs/common';
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { CreateKycSubmissionDto, ReviewKycSubmissionDto } from './dto/kyc.dto';
import { KycService } from './kyc.service';
import { KycSubmissionFiles } from './kyc.types';

<<<<<<< HEAD
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { CreateKycSubmissionDto } from './dto/create-kyc-submission.dto';
import { BadRequestException } from '@nestjs/common';
import { UploadsService } from '../uploads/uploads.service';

=======
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per file

@ApiTags('kyc')
>>>>>>> origin/Backend/KYC/SubmissionEndpoint
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('submission')
<<<<<<< HEAD
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'document', maxCount: 1 },
        { name: 'selfie', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
      },
    ),
  )
  async submitKyc(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateKycSubmissionDto,
    @UploadedFiles()
    files: {
      document?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
    },
  ) {
    if (!files.document?.[0] || !files.selfie?.[0]) {
      throw new BadRequestException(
        'Both document and selfie images are required',
      );
    }

    const document = await new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
        new FileTypeValidator({
          fileType: /(jpg|jpeg|png|webp)$/i,
        }),
      ],
    }).transform(files.document[0]);

    const selfie = await new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
        new FileTypeValidator({
          fileType: /(jpg|jpeg|png|webp)$/i,
        }),
      ],
    }).transform(files.selfie[0]);

    return this.kycService.submitKyc(
      userId,
      dto,
      document,
      selfie,
    );
  }

  @Roles(UserRole.ADMIN)
=======
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
  @ApiOkResponse({ description: 'KYC submission received successfully.' })
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

>>>>>>> origin/Backend/KYC/SubmissionEndpoint
  @Patch('submission/admin/:id/status')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Approve or reject a KYC submission (admin only)',
  })
  @ApiBody({ type: ReviewKycSubmissionDto })
  @ApiOkResponse({ description: 'KYC submission reviewed successfully.' })
  reviewSubmission(
    @Param('id', new ParseUUIDPipe()) submissionId: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: ReviewKycSubmissionDto,
  ) {
    return this.kycService.reviewSubmission(submissionId, adminId, dto);
  }
}
