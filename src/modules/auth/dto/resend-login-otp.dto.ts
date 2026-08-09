import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString } from 'class-validator';

export class ResendLoginOtpDto {
  @ApiProperty({
    description:
      'The short-lived otpToken returned by /auth/login or /auth/admin/login ' +
      'when two-factor authentication is enabled. Used to re-send a fresh code ' +
      'to the account email without re-submitting the password.',
  })
  @IsString()
  @IsJWT()
  otpToken!: string;
}
