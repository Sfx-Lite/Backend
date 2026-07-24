import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

import { IsStrongPassword } from '../../../common/decorators/is-strong-password.decorator';

export class UpdatePasswordDto {
  @ApiProperty({
    example: 'current-password',
    description: 'The user’s current password, verified before any change.',
  })
  @IsString()
  @MinLength(1)
  oldPassword!: string;

  @ApiProperty({
    example: 'New-super-secret1',
    description:
      'The new password. At least 8 characters, with 1 uppercase letter, 1 number and 1 special character.',
  })
  @IsString()
  @IsStrongPassword()
  newPassword!: string;
}
