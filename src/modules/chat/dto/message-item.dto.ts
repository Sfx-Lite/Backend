import { ApiProperty } from '@nestjs/swagger';
import { ChatRole } from '../enums/chat-role.enum';

export class MessageItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ enum: ChatRole }) role!: ChatRole;
  @ApiProperty() content!: string;
}
