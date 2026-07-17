import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString } from 'class-validator';

/**
 * RefreshDto — Squad A
 * ────────────────────
 * Body for POST /auth/refresh. The FE sends the refresh token it received from
 * login/registration; class-validator rejects anything that isn't a JWT before
 * the service runs.
 */
export class RefreshDto {
  @ApiProperty({
    description: 'The refresh token issued at login or registration.',
  })
  @IsString()
  @IsJWT()
  refreshToken!: string;
}
