import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class Set2faDto {
  @ApiProperty({
    example: true,
    description:
      'Whether email-OTP two-factor authentication should be enabled for login.',
  })
  @IsBoolean()
  enabled!: boolean;
}
