import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * LoginDto — STRUCTURE REFERENCE ONLY (Squad A)
 * ─────────────────────────────────────────────
 * Same idea as RegisterDto: declare the fields the /auth/login route
 * accepts and let class-validator enforce them automatically.
 *
 * `emailOrUsername` accepts EITHER the user's email or their username, so we
 * validate it as a plain non-empty string rather than @IsEmail — the service
 * decides which column to match on.
 */
export class LoginDto {
  @ApiProperty({
    example: 'ada@example.com',
    description: "The user's email address or username.",
  })
  @IsString()
  @MinLength(1)
  emailOrUsername!: string;

  @ApiProperty({ example: 'super-secret' })
  @IsString()
  @MinLength(8)
  password!: string;
}
