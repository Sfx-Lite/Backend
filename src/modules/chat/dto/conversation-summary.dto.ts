import { ApiProperty } from '@nestjs/swagger';

export class ConversationSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() conversationTitle!: string;
  @ApiProperty({
    description: 'Timestamp of the most recent message in this conversation',
  })
  lastMessageAt!: Date;
}
