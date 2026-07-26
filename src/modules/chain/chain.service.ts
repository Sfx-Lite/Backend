import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Contract,
  EventLog,
  FetchRequest,
  JsonRpcProvider,
  formatUnits,
  getAddress,
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

  /** Latest block height on Amoy. */
  getBlockNumber(): Promise<number> {
    return this.provider().getBlockNumber();
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
