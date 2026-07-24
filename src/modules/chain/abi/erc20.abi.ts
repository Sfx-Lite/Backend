/**
 * Minimal ERC-20 fragment — just what the escrow needs from USDC on Amoy:
 * the Transfer event (deposit watching) plus decimals/balanceOf (amount
 * formatting and reconciliation). Human-readable ABI, parsed by ethers.
 */
export const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
] as const;
