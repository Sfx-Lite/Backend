import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { BeneficiaryType } from '../enums/beneficiary-type.enum';

/**
 * CreateBeneficiaryDto — save a payee. For an INTERNAL beneficiary `identifier`
 * is the recipient's SFx username; for an EXTERNAL one it's a wallet address.
 * `name` is an optional label; if omitted it defaults to the identifier.
 */
export class CreateBeneficiaryDto {
  @ApiProperty({
    enum: BeneficiaryType,
    example: BeneficiaryType.INTERNAL,
    description: 'internal (another SFx user) or external (an on-chain address).',
  })
  @IsEnum(BeneficiaryType)
  type!: BeneficiaryType;

  @ApiProperty({
    example: 'bob',
    description:
      'The SFx username (internal) or the 0x wallet address (external) to save.',
  })
  @IsString()
  @MaxLength(120)
  identifier!: string;

  @ApiPropertyOptional({
    example: 'Bob (rent)',
    description: 'Optional display label. Defaults to the identifier.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
