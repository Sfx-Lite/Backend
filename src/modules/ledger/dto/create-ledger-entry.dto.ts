import { IsEnum, IsNumberString, IsString, IsUUID } from 'class-validator';
import { LedgerDirection } from '../enums/ledger-direction.enum';

export class CreateLedgerEntryDto {
  @IsUUID()
  transactionId!: string;

  @IsUUID()
  userId!: string;

  @IsEnum(LedgerDirection)
  direction!: LedgerDirection;

  @IsString()
  asset!: string;

  @IsNumberString()
  amount!: string;
}