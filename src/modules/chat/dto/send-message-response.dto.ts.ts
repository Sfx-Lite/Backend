import { ApiProperty } from '@nestjs/swagger';
import { MessageItemDto } from './message-item.dto';

export class SendMessageResponseDto {
  @ApiProperty() conversationId!: string;
  @ApiProperty({ type: MessageItemDto }) message!: MessageItemDto;
}
