import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

import { IsStrongPassword } from '../../../common/decorators/is-strong-password.decorator';

/**
 * Permissive international phone format (shared rule with UpdateProfileDto): an
 * optional leading "+", then 7–20 characters of digits and common separators
 * (spaces, dashes, parentheses). Country-agnostic — numbers from every country
 * are accepted, with no per-region format enforced.
 */
const PHONE_REGEX = /^\+?[0-9][0-9\s().-]{5,18}$/;

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
   * Any country is supported. We accept an optional leading "+" followed by
   * 7–20 characters of digits and common separators (spaces, dashes,
   * parentheses) — e.g. +2348012345678 (NG), +1 (415) 555-2671 (US),
   * 07911 123456 (GB). No per-region format is enforced, so no country is
   * rejected.
   */
  @ApiProperty({
    example: '+2348012345678',
    description:
      'International phone number, any country. Optional leading "+" then ' +
      '7–20 digits (spaces, dashes and parentheses allowed).',
  })
  @IsString()
  @Matches(PHONE_REGEX, {
    message: 'mobileNumber must be a valid phone number',
  })
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
