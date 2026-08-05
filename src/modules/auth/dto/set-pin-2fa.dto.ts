import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetPin2faDto {
  @ApiProperty({
    example: true,
    description: 'Whether PIN-based two-factor authentication should be enabled.',
  })
  @IsBoolean()
  enabled!: boolean;
}