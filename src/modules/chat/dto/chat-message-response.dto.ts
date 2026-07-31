import { ApiProperty } from '@nestjs/swagger';
import { ChatRole } from '../enums/chat-role.enum';

export class ChatMessageResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  conversationId!: string;

  @ApiProperty({ enum: ChatRole, example: ChatRole.ASSISTANT })
  role!: ChatRole;

  @ApiProperty({
    example: 'KYC verification is required before you can send funds...',
  })
  content!: string;

  @ApiProperty({ example: '2026-07-30T14:22:01.000Z' })
  createdAt!: Date;
}
