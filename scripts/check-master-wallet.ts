import * as dotenv from 'dotenv';
import {
  Contract,
  formatEther,
  formatUnits,
  HDNodeWallet,
  JsonRpcProvider,
  Mnemonic,
  parseEther,
} from 'ethers';

dotenv.config();

/**
 * Confirms the hot master wallet is created (derivable from the mnemonic) and
 * funded (holds POL for gas + test USDC on Polygon Amoy).
 *
 *   npx ts-node scripts/check-master-wallet.ts
 *
 * The master wallet is the account at index 0 of the master mnemonic.
 * NOTE: nothing here can spend — it only reads public balances.
 */
const MASTER_PATH = "m/44'/60'/0'/0/0";

const RPC = process.env.ALCHEMY_AMOY_RPC_URL;
const MNEMONIC = process.env.MASTER_WALLET_MNEMONIC;
const USDC = process.env.USDC_TOKEN_ADDRESS;

// Each sweep gas-drops GAS_DROP_POL to a deposit address AND pays gas to send
// it; withdrawals pay gas too. "Non-zero" is not "funded" — require a real
// reserve. Single source of truth with the app's runtime gas-health alert
// (GET /admin/gas): the MIN_POL_FLOOR env var, default 0.2 POL (~100
// withdrawals / dozens of sweeps of headroom).
const MIN_POL_FLOOR = process.env.MIN_POL_FLOOR ?? '0.2';
const MIN_POL = parseEther(MIN_POL_FLOOR);

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

async function main(): Promise<void> {
  if (!RPC || !MNEMONIC) {
    throw new Error(
      'Set ALCHEMY_AMOY_RPC_URL and MASTER_WALLET_MNEMONIC in .env first.',
    );
  }

  const provider = new JsonRpcProvider(RPC);
  const wallet = HDNodeWallet.fromMnemonic(
    Mnemonic.fromPhrase(MNEMONIC),
    MASTER_PATH,
  );

  const [network, polWei] = await Promise.all([
    provider.getNetwork(),
    provider.getBalance(wallet.address),
  ]);

  console.log('── Master hot wallet ───────────────────────────────');
  console.log('  path      :', MASTER_PATH);
  console.log('  address   :', wallet.address);
  console.log('  network   :', `chainId ${network.chainId} (Amoy = 80002)`);
  console.log('  POL (gas) :', formatEther(polWei), 'POL');

  if (USDC) {
    const token = new Contract(USDC, ERC20_ABI, provider);
    const [rawBal, decimals, symbol] = await Promise.all([
      token.balanceOf(wallet.address),
      token.decimals(),
      token.symbol(),
    ]);
    console.log(
      `  ${symbol}      :`,
      formatUnits(rawBal, decimals),
      symbol,
      `(token ${USDC})`,
    );
  } else {
    console.log('  USDC      : USDC_TOKEN_ADDRESS not set — skipped');
  }

  console.log(
    '  explorer  : https://amoy.polygonscan.com/address/' + wallet.address,
  );
  console.log('────────────────────────────────────────────────────');
  if (polWei >= MIN_POL) {
    console.log('✓ Has gas (POL). Ready to broadcast sweeps/withdrawals.');
  } else if (polWei > 0n) {
    console.log(
      `✗ LOW on POL: ${formatEther(polWei)} POL is below the ${formatEther(MIN_POL)} POL floor ` +
        `(MIN_POL_FLOOR=${MIN_POL_FLOOR}). Sweeps/withdrawals will fail with ` +
        `INSUFFICIENT_FUNDS — top up from the Polygon Amoy faucet.`,
    );
    process.exitCode = 1;
  } else {
    console.log('✗ No POL yet — fund it from the Polygon Amoy faucet.');
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
