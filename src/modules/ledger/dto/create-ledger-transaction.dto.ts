import { ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateLedgerEntryDto } from './create-ledger-entry.dto';

export class CreateLedgerTransactionDto {

  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateLedgerEntryDto)
  entries!: CreateLedgerEntryDto[];
}