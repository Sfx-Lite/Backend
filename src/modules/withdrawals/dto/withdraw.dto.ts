import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * WithdrawDto — request an on-chain USDC withdrawal to an external wallet.
 * amount is a decimal string (USDC, ≤ 6dp); externalAddress is an EVM address;
 * pin is the caller's transaction PIN (verified server-side, with lockout).
 */
export class WithdrawDto {
  @ApiProperty({
    example: '25.5',
    description: 'Amount of USDC to withdraw (decimal string, up to 6dp).',
  })
  @Matches(/^\d+(\.\d{1,6})?$/, {
    message: 'amount must be a positive decimal with up to 6 decimal places',
  })
  amount!: string;

  @ApiProperty({
    example: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    description: 'Destination EVM wallet address on Polygon Amoy.',
  })
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'externalAddress must be a valid 0x-prefixed EVM address',
  })
  externalAddress!: string;

  @ApiProperty({
    example: '1234',
    description: 'The caller’s transaction PIN.',
  })
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'pin must be 4–6 digits' })
  pin!: string;

  @ApiProperty({
    required: false,
    example: 'Rent payment',
    description: 'Optional note attached to the withdrawal.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
