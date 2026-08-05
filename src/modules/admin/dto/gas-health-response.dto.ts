import { ApiProperty } from '@nestjs/swagger';

/** How the master hot wallet's native-POL (gas) reserve is doing. */
export type GasHealthStatus = 'healthy' | 'low' | 'empty';

/**
 * Master-wallet gas health — read-only snapshot behind GET /admin/gas.
 * The master wallet pays native POL for every sweep gas-drop and every
 * withdrawal broadcast; if it runs dry, both fail with INSUFFICIENT_FUNDS.
 * This surfaces the reserve, the per-withdrawal cost, and how many withdrawals
 * the current balance still covers so admins can top up before an outage.
 */
export class GasHealthResponseDto {
  @ApiProperty({ example: '0xeF7FA7Ef55dfAA003C6991016194a21677271347' })
  masterAddress!: string;

  @ApiProperty({
    example: '0.000355',
    description: 'Current native POL (gas) balance of the master wallet.',
  })
  polBalance!: string;

  @ApiProperty({
    example: '0.00195',
    description:
      'Estimated POL to broadcast ONE withdrawal (a single USDC transfer): ' +
      'gasLimit × current gas price. No POL is sent to the recipient.',
  })
  perWithdrawalPol!: string;

  @ApiProperty({
    example: 0,
    description:
      'Whole withdrawals the current POL balance can still fund at the current ' +
      'gas price (floor(polBalance ÷ perWithdrawalPol)).',
  })
  withdrawalsRemaining!: number;

  @ApiProperty({
    example: '0.2',
    description: 'The LOW threshold (MIN_POL_FLOOR). Below this, admins are alerted.',
  })
  floorPol!: string;

  @ApiProperty({
    example: 'empty',
    enum: ['healthy', 'low', 'empty'],
    description:
      "'healthy' ≥ floor · 'low' below floor but can still fund ≥1 withdrawal · " +
      "'empty' can't fund a single withdrawal.",
  })
  status!: GasHealthStatus;

  @ApiProperty({
    example: true,
    description: 'True when status is below floor and an admin alert was raised.',
  })
  alerted!: boolean;

  @ApiProperty({ example: '2026-08-05T08:07:24.167Z' })
  checkedAt!: string;
}
