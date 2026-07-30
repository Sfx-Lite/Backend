import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { KycStatus } from '../enums/kyc-status.enum';

/**
 * UpdateKycStatusDto — admin override of a user's KYC status. The status must
 * be one of the KycStatus enum values (unverified / pending / verified /
 * rejected).
 */
export class UpdateKycStatusDto {
  @ApiProperty({
    enum: KycStatus,
    example: KycStatus.VERIFIED,
    description: 'The new KYC status to set on the user.',
  })
  @IsEnum(KycStatus)
  kycStatus!: KycStatus;
}
