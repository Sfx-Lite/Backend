import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsPositive, IsString, Length } from 'class-validator';

export class CalculateFeeDto {
  @ApiProperty({
    description: 'Transfer amount in the source currency.',
    example: 1000,
  })
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({
    description: 'Source currency (3-letter ISO code).',
    example: 'USD',
  })
  @Transform(({ value }: { value: unknown }) => String(value).toUpperCase())
  @IsString()
  @Length(3, 3)
  from!: string;

  @ApiProperty({
    description: 'Destination currency (3-letter ISO code).',
    example: 'EUR',
  })
  @Transform(({ value }: { value: unknown }) => String(value).toUpperCase())
  @IsString()
  @Length(3, 3)
  to!: string;
}
