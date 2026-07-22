import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsPhoneNumber, IsString, MinLength } from 'class-validator';

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

  @ApiProperty({ example: '+2348012345678' })
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

  @ApiProperty({ example: 'super-secret', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
