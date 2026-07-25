import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Permissive international phone format shared with registration: an optional
 * leading "+", then 7–20 characters of digits and common separators (spaces,
 * dashes, parentheses). Country-agnostic on purpose — we accept numbers from
 * every country and do not enforce a per-region format.
 */
const PHONE_REGEX = /^\+?[0-9][0-9\s().-]{5,18}$/;

/**
 * UpdateProfileDto — the editable subset of a user's profile.
 *
 * username and email are intentionally NOT part of this DTO: they are immutable
 * from the profile page. mobileNumber IS editable (with the same E.164
 * validation and uniqueness rules as registration). The global ValidationPipe
 * runs with forbidNonWhitelisted, so any other extra field is rejected before
 * this reaches the service. Every field is optional so the client can PATCH
 * just what changed.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: '+2348012345678',
    description:
      'International phone number, any country. Optional leading "+" then ' +
      '7–20 digits (spaces, dashes and parentheses allowed).',
  })
  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, {
    message: 'mobileNumber must be a valid phone number',
  })
  mobileNumber?: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Michael' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: '12 Marina Road' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  streetAddress1?: string;

  @ApiPropertyOptional({ example: 'Apartment 4B' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  streetAddress2?: string;

  @ApiPropertyOptional({ example: 'Lagos' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Lagos' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: 'Nigeria' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;
}
