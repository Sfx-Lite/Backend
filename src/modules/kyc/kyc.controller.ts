import { Body, Controller, Param, ParseUUIDPipe, Patch } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { ReviewKycSubmissionDto } from './dto/kyc.dto';
import { KycService } from './kyc.service';

@Controller('kyc')
@Roles(UserRole.ADMIN)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Patch('submission/admin/:id/status')
  reviewSubmission(
    @Param('id', new ParseUUIDPipe()) submissionId: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: ReviewKycSubmissionDto,
  ) {
    return this.kycService.reviewSubmission(submissionId, adminId, dto);
  }
}
