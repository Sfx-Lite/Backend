import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * CheckUsernameDto — Squad A
 * ──────────────────────────
 * Query contract for GET /auth/username-available. Mirrors the `username`
 * rules in RegisterDto so a name that passes this check is one that could
 * actually be registered.
 */
export class CheckUsernameDto {
  @ApiProperty({ example: 'johndoe' })
  @IsString()
  @MinLength(3)
  username!: string;
}
