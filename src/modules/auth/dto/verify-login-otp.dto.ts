import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString, Matches } from 'class-validator';

export class VerifyLoginOtpDto {
  @ApiProperty({
    description:
      'Short-lived token returned by /auth/login (or /auth/admin/login) when ' +
      'two-factor authentication is enabled and an OTP was emailed.',
  })
  @IsString()
  @IsJWT()
  otpToken!: string;

  @ApiProperty({
    example: '123456',
    description: 'The 6-digit one-time code sent to the account email.',
  })
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'OTP must contain exactly 6 digits',
  })
  otp!: string;
}
