import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsPhoneNumber, IsString, MinLength } from 'class-validator';

import { IsStrongPassword } from '../../../common/decorators/is-strong-password.decorator';

/**
 * RegisterDto — Squad A
 * ─────────────────────
 * A DTO defines the exact shape of a request body and its validation rules.
 * The global ValidationPipe (see main.ts) strips unknown fields, rejects
 * extras, and runs these decorators before the controller is ever called —
 * so the service can trust its input.
 *
 * @ApiProperty feeds Swagger at /docs.
 */
export class RegisterDto {
  @ApiProperty({ example: 'johndoe' })
  @IsString()
  @MinLength(3)
  username!: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email!: string;

  /**
   * Any country is supported. `@IsPhoneNumber()` with no region argument
   * accepts a valid international number for ANY country, but it must be in
   * E.164 format (leading "+" and country code), e.g. +2348012345678 (NG),
   * +14155552671 (US), +447911123456 (GB).
   */
  @ApiProperty({
    example: '+2348012345678',
    description: 'International phone number in E.164 format (any country).',
  })
  @IsString()
  @IsPhoneNumber()
  mobileNumber!: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(2)
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(2)
  lastName!: string;

  @ApiProperty({ example: 'Nigeria' })
  @IsString()
  @MinLength(2)
  country!: string;

  @ApiProperty({
    example: 'Super-secret1',
    description:
      'At least 8 characters, with 1 uppercase letter, 1 number and 1 special character.',
  })
  @IsString()
  @IsStrongPassword()
  password!: string;
}
