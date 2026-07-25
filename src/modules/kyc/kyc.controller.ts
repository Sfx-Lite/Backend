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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { ReviewKycSubmissionDto } from './dto/kyc.dto';
import { KycService } from './kyc.service';

import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { CreateKycSubmissionDto } from './dto/create-kyc-submission.dto';
import { BadRequestException } from '@nestjs/common';
import { UploadsService } from '../uploads/uploads.service';

@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('submission')
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
  @Patch('submission/admin/:id/status')
  reviewSubmission(
    @Param('id', new ParseUUIDPipe()) submissionId: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: ReviewKycSubmissionDto,
  ) {
    return this.kycService.reviewSubmission(submissionId, adminId, dto);
  }
}
