import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ResetPinDto {
  @ApiProperty({
    example: '1234',
    description: 'The user’s current 4-digit transaction PIN.',
    pattern: '^\\d{4}$',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @Matches(/^\d{4}$/, {
    message: 'Old PIN must contain exactly 4 digits',
  })
  oldPin!: string;

  @ApiProperty({
    example: '5678',
    description: 'The new 4-digit transaction PIN.',
    pattern: '^\\d{4}$',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @Matches(/^\d{4}$/, {
    message: 'New PIN must contain exactly 4 digits',
  })
  newPin!: string;
}