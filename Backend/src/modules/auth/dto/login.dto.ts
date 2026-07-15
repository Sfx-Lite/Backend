import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * LoginDto — STRUCTURE REFERENCE ONLY (Squad A)
 * ─────────────────────────────────────────────
 * Same idea as RegisterDto: declare the fields the /auth/login route
 * accepts and let class-validator enforce them automatically.
 */
export class LoginDto {
  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'super-secret' })
  @IsString()
  @MinLength(8)
  password!: string;
}
