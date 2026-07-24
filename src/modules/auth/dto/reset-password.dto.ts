import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

import { IsStrongPassword } from '../../../common/decorators/is-strong-password.decorator';

/**
 * ResetPasswordDto — body for POST /auth/reset-password/:token. The token is
 * taken from the URL param (from the emailed link); only the new password is
 * carried in the body.
 */
export class ResetPasswordDto {
  @ApiProperty({
    example: 'New-super-secret1',
    description:
      'The new password. At least 8 characters, with 1 uppercase letter, 1 number and 1 special character.',
  })
  @IsString()
  @IsStrongPassword()
  newPassword!: string;
}
