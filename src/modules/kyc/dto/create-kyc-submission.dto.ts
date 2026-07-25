import { IsEnum } from 'class-validator';
import { KycDocType } from '../enums/kyc-doc-type.enum';

export class CreateKycSubmissionDto {
  @IsEnum(KycDocType)
  docType!: KycDocType;
}
