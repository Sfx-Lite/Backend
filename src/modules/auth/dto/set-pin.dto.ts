import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class SetPinDto {
  @ApiProperty({
    example: '1234',
    description: 'The 4-digit transaction PIN to set for the account.',
    pattern: '^\\d{4}$',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @Matches(/^\d{4}$/, {
    message: 'PIN must contain exactly 4 digits',
  })
  pin!: string;
}
