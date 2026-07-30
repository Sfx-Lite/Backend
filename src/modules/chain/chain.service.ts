import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Contract,
  EventLog,
  FetchRequest,
  HDNodeWallet,
  JsonRpcProvider,
  formatUnits,
  getAddress,
  parseEther,
  parseUnits,
} from 'ethers';

import { env } from '../../config/env';
import { ERC20_ABI } from './abi/erc20.abi';

/** A confirmed USDC transfer into one of our addresses, normalised for the ledger. */
export interface UsdcTransfer {
  /** Checksummed recipient (a user deposit address or the master wallet). */
  to: string;
  /** Checksummed sender. */
  from: string;
  /** Decimal string at USDC's 6dp scale, e.g. "10.5". */
  amount: string;
  txHash: string;
  logIndex: number;
  blockNumber: number;
}

/**
 * ChainService — Squad B (Wallet & Escrow).
 * ─────────────────────────────────────────
 * The single door to Polygon Amoy. Wraps one ethers JsonRpcProvider and the
 * USDC contract so the deposit watcher, sweep and withdrawal jobs never build
 * their own provider or juggle ABIs.
 *
 * Like WalletsService, this is intentionally unavailable until the Backend Lead
 * sets ALCHEMY_AMOY_RPC_URL + USDC_TOKEN_ADDRESS — the app still boots in
 * Week 1 with chain features dormant. Any RPC endpoint works in the env var
 * (Alchemy, PublicNode, dRPC, …); the name is historical.
 */
@Injectable()
export class ChainService {
  private readonly logger = new Logger(ChainService.name);

  private cachedProvider: JsonRpcProvider | null = null;
  private cachedUsdc: Contract | null = null;
  private cachedDecimals: number | null = null;

  /** True only when both the RPC URL and USDC address are configured. */
  isConfigured(): boolean {
    return Boolean(env.chain.rpcUrl && env.chain.usdcAddress);
  }

  private provider(): JsonRpcProvider {
    if (this.cachedProvider) {
      return this.cachedProvider;
    }
    if (!env.chain.rpcUrl) {
      throw new ServiceUnavailableException(
        'Chain service unavailable: ALCHEMY_AMOY_RPC_URL is not configured',
      );
    }
    // Wrap the URL in a FetchRequest so we can bound how long a single RPC call
    // may hang — a slow node then aborts fast and the watcher retries next poll,
    // instead of blocking for minutes on ethers' long default timeout.
    const request = new FetchRequest(env.chain.rpcUrl);
    request.timeout = env.chain.requestTimeoutMs;

    // Amoy chainId 80002, pinned as a static network so ethers skips the
    // per-call eth_chainId round-trip (kinder to the RPC free tier).
    this.cachedProvider = new JsonRpcProvider(request, 80002, {
      staticNetwork: true,
    });
    return this.cachedProvider;
  }

  private usdc(): Contract {
    if (this.cachedUsdc) {
      return this.cachedUsdc;
    }
    if (!env.chain.usdcAddress) {
      throw new ServiceUnavailableException(
        'Chain service unavailable: USDC_TOKEN_ADDRESS is not configured',
      );
    }
    this.cachedUsdc = new Contract(
      getAddress(env.chain.usdcAddress),
      ERC20_ABI,
      this.provider(),
    );
    return this.cachedUsdc;
  }

  /**
   * The shared provider, for the escrow jobs that need to connect a signer
   * (sweep, withdrawal). Read-only callers should use the higher-level helpers
   * below instead of touching the provider directly.
   */
  getProvider(): JsonRpcProvider {
    return this.provider();
  }

  /** Latest block height on Amoy. */
  getBlockNumber(): Promise<number> {
    return this.provider().getBlockNumber();
  }

  /** Native POL balance of an address (wei), used for gas-drop decisions. */
  getNativeBalance(address: string): Promise<bigint> {
    return this.provider().getBalance(getAddress(address));
  }

  /**
   * Send native POL from `signer` to `to` (for gas-dropping a deposit address
   * before its USDC can be swept). Waits 1 confirmation. Returns the tx hash.
   */
  async sendNative(
    signer: HDNodeWallet,
    to: string,
    amountPol: string,
  ): Promise<string> {
    const tx = await signer.sendTransaction({
      to: getAddress(to),
      value: parseEther(amountPol),
    });
    await tx.wait(1);
    this.logger.log(`Gas-drop ${amountPol} POL → ${to} (${tx.hash})`);
    return tx.hash;
  }

  /**
   * Broadcast a USDC transfer of `amount` (decimal string) from `signer` to
   * `to`. Used by the sweep (deposit address → master) and the withdrawal
   * (master → external). Returns the broadcast tx hash immediately after the
   * node accepts it (confirmation is tracked separately).
   */
  async sendUsdc(
    signer: HDNodeWallet,
    to: string,
    amount: string,
  ): Promise<string> {
    if (!env.chain.usdcAddress) {
      throw new ServiceUnavailableException(
        'Chain service unavailable: USDC_TOKEN_ADDRESS is not configured',
      );
    }
    const decimals = await this.usdcDecimals();
    const contract = new Contract(
      getAddress(env.chain.usdcAddress),
      ERC20_ABI,
      signer,
    );
    const value = parseUnits(amount, decimals);
    const tx = (await contract.transfer(getAddress(to), value)) as {
      hash: string;
    };
    this.logger.log(`USDC ${amount} → ${to} broadcast (${tx.hash})`);
    return tx.hash;
  }

  /** How many confirmations a tx has (0 if not yet mined / unknown). */
  async getConfirmations(txHash: string): Promise<number> {
    const receipt = await this.provider().getTransactionReceipt(txHash);
    if (!receipt) {
      return 0;
    }
    const head = await this.provider().getBlockNumber();
    return Math.max(0, head - receipt.blockNumber + 1);
  }

  /**
   * The settled status of a broadcast tx:
   *  - 'success' — mined with status 1,
   *  - 'failed'  — mined-but-reverted, OR dropped (no receipt and the node no
   *    longer knows the tx),
   *  - 'pending' — accepted but not yet mined.
   */
  async getReceiptStatus(
    txHash: string,
  ): Promise<'success' | 'failed' | 'pending'> {
    const receipt = await this.provider().getTransactionReceipt(txHash);
    if (receipt) {
      return receipt.status === 1 ? 'success' : 'failed';
    }
    const tx = await this.provider().getTransaction(txHash);
    return tx ? 'pending' : 'failed';
  }

  /** USDC decimals (6 on Amoy), read once then cached. Falls back to 6. */
  async usdcDecimals(): Promise<number> {
    if (this.cachedDecimals !== null) {
      return this.cachedDecimals;
    }
    try {
      this.cachedDecimals = Number(await this.usdc().decimals());
    } catch {
      this.cachedDecimals = 6;
    }
    return this.cachedDecimals;
  }

  /** On-chain USDC balance of an address, as a 6dp decimal string. */
  async usdcBalanceOf(address: string): Promise<string> {
    const [raw, decimals] = await Promise.all([
      this.usdc().balanceOf(getAddress(address)) as Promise<bigint>,
      this.usdcDecimals(),
    ]);
    return formatUnits(raw, decimals);
  }

  /**
   * All USDC Transfer events sent TO any of `addresses` in [fromBlock, toBlock].
   * Uses an indexed-topic OR filter so one RPC call covers every user address.
   * Zero-value transfers are dropped. Amounts come back as decimal strings.
   */
  async queryUsdcTransfersTo(
    addresses: string[],
    fromBlock: number,
    toBlock: number,
  ): Promise<UsdcTransfer[]> {
    if (addresses.length === 0 || fromBlock > toBlock) {
      return [];
    }

    const usdc = this.usdc();
    const decimals = await this.usdcDecimals();
    const checksummed = addresses.map((a) => getAddress(a));

    const filter = usdc.filters.Transfer(null, checksummed);
    // Hosted RPC free tiers cap eth_getLogs at a small block span (Alchemy Amoy
    // free tier = 10), so page through [fromBlock, toBlock] in windows of
    // maxRange blocks instead of requesting the whole range in one call.
    const maxRange = Math.max(1, env.chain.getLogsMaxRange);

    const transfers: UsdcTransfer[] = [];
    for (let start = fromBlock; start <= toBlock; start += maxRange) {
      const end = Math.min(start + maxRange - 1, toBlock);
      const logs = await usdc.queryFilter(filter, start, end);

      for (const log of logs) {
        // queryFilter with a parsed ABI yields EventLog (has .args); guard anyway.
        if (!(log instanceof EventLog)) {
          continue;
        }
        const value = log.args.value as bigint;
        if (value <= 0n) {
          continue;
        }
        transfers.push({
          to: getAddress(log.args.to as string),
          from: getAddress(log.args.from as string),
          amount: formatUnits(value, decimals),
          txHash: log.transactionHash,
          logIndex: log.index,
          blockNumber: log.blockNumber,
        });
      }
    }
    return transfers;
  }
}
