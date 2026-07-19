import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString } from 'class-validator';

/**
 * GoogleVerifyDto — Squad A
 * ─────────────────────────
 * Body for POST /auth/google/verify.
 *
 * This is the SPA/mobile-friendly alternative to the browser redirect flow
 * (GET /auth/google → Google → GET /auth/google/callback). The frontend runs
 * Google Identity Services (the "Sign in with Google" button / One Tap)
 * entirely client-side, receives a signed **ID token** (aka `credential`), and
 * POSTs it here. The server verifies that token against Google's public keys —
 * no redirect_uri round-trip needed.
 */
export class GoogleVerifyDto {
  @ApiProperty({
    description:
      'The Google ID token (the `credential` returned by Google Identity ' +
      'Services on the client). The server verifies its signature, issuer, ' +
      'audience and expiry before trusting it.',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...<google-id-token>...',
  })
  @IsString()
  @IsJWT()
  idToken!: string;
}
