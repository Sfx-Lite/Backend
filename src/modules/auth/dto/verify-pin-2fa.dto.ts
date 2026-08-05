import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString, Matches } from 'class-validator';

export class VerifyPin2faDto {
  @ApiProperty({
    description: 'Temporary token returned after successful password verification',
  })
  @IsString()
  @IsJWT()
  pinToken!: string;

  @ApiProperty({
    example: '1234',
    description: 'The user’s 4-digit transaction PIN',
  })
  @IsString()
  @Matches(/^\d{4}$/, {
    message: 'PIN must contain exactly 4 digits',
  })
  pin!: string;
}