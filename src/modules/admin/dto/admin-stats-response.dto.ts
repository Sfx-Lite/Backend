import { ApiProperty } from '@nestjs/swagger';

class UserStatsDto {
  @ApiProperty() total!: number;
  @ApiProperty() active!: number;
  @ApiProperty() inactive!: number;
}

export class AdminStatsResponseDto {
  @ApiProperty({ type: UserStatsDto })
  users!: UserStatsDto;

  @ApiProperty({
    nullable: true,
    description: 'Blocked — KYC service not built yet',
  })
  pendingKyc!: number | null;

  @ApiProperty({
    nullable: true,
    description: 'Blocked — 7-day volume scope not yet confirmed with team',
  })
  volume!: number | null;

  @ApiProperty({
    nullable: true,
    description: 'Blocked — no master wallet module exists yet',
  })
  masterWallet!: number | null;
}
