import { ApiProperty } from '@nestjs/swagger';

class UserStatsDto {
  @ApiProperty() total!: number;
  @ApiProperty() active!: number;
  @ApiProperty() inactive!: number;
}

export class StatsOverviewResponseDto {
  @ApiProperty({ type: UserStatsDto })
  users!: UserStatsDto;

  @ApiProperty({
    description: 'Count of KYC submissions with status = pending',
  })
  pendingKyc!: number;

  @ApiProperty({
    description:
      '7-day volume in USDC — successful, non-sweep transactions only',
  })
  volume!: number;

  @ApiProperty({ description: 'Live master wallet USDC balance' })
  masterWallet!: number;
}
