import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Body for POST /transactions/transfer — send USDC to another SFx Lite user.
 * The recipient is identified by username (the same handle the signup form
 * checks for availability); the amount is a decimal string, never a float.
 */
export class TransferDto {
  @ApiProperty({
    example: 'johndoe',
    description: 'Username of the SFx Lite user to send to.',
  })
  @IsString()
  @MaxLength(50)
  recipientUsername!: string;

  @ApiProperty({
    example: '10.50',
    description: 'USDC amount to send, up to 6 decimal places.',
    pattern: '^\\d+(\\.\\d{1,6})?$',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,6})?$/, {
    message: 'Amount must be a positive number with up to 6 decimal places',
  })
  amount!: string;

  @ApiPropertyOptional({
    example: 'Contribution for Alenenu Grammar school reunion in Qatar',
    description: 'Optional note shown on the transaction.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  note?: string;
}
