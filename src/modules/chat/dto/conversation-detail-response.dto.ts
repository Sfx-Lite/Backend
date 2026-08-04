import { ApiProperty } from '@nestjs/swagger';
import { MessageItemDto } from './message-item.dto';

export class ConversationDetailResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() conversationTitle!: string;
  @ApiProperty({ type: [MessageItemDto] }) messages!: MessageItemDto[];
}
