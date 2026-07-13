import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * RegisterDto — STRUCTURE REFERENCE ONLY (Squad A)
 * ────────────────────────────────────────────────
 * A DTO defines the exact shape of a request body and its validation rules.
 * The global ValidationPipe (see main.ts) strips unknown fields, rejects
 * extras, and runs these decorators before the controller is ever called —
 * so the service can trust its input.
 *
 * @ApiProperty feeds Swagger at /docs.
 */
export class RegisterDto {
  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ example: 'super-secret', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
