import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsPositive,
  IsString,
  Length,
} from 'class-validator';

export class CalculateFeeDto {
  @Transform(({ value }: { value: unknown }) =>
    Number(value),
  )
  @IsNumber()
  @IsPositive()
  amount!: number;

  @Transform(({ value }: { value: unknown }) =>
    String(value).toUpperCase(),
  )
  @IsString()
  @Length(3, 3)
  from!: string;

  @Transform(({ value }: { value: unknown }) =>
    String(value).toUpperCase(),
  )
  @IsString()
  @Length(3, 3)
  to!: string;
}