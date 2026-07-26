import { IsNumber, IsPositive, IsString } from 'class-validator';

export class CalculateFeeDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  fromCurrency!: string;

  @IsString()
  toCurrency!: string;
}
