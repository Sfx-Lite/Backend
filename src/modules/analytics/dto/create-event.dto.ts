import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsObject, IsOptional } from 'class-validator';

/**
 * CreateEventDto — defines the shape of a POST /events request body.
 * user_id and actor_type are deliberately NOT included here — both are
 * derived server-side from the authenticated request, never trusted
 * from the client (a user could otherwise claim to be an admin).
 */

export class CreateEventDto {
    @ApiProperty({ example: 'signup_completed' })
    @IsString()
    @IsNotEmpty()
    eventName!: string;

    @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
    @IsUUID()
    sessionId!: string;

    @ApiProperty({ required: false, example: { reason: 'blurry_document' } })
    @IsOptional()
    @IsObject()
    properties?: Record<string, unknown>;
}