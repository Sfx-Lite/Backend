import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Atomic allocation of BIP-44 derivation indices for user deposit wallets.
 *
 * A Postgres sequence hands out a unique, monotonically increasing index to
 * each new wallet, so concurrent signups can never derive the same address.
 * Starts at 0 so the first user maps to m/44'/60'/0'/0/0.
 * Gaps (from rolled-back signups) are harmless — the index only needs to be
 * unique, not contiguous.
 */
export class WalletDerivationSequence1784200000000 implements MigrationInterface {
  name = 'WalletDerivationSequence1784200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS "wallet_derivation_index_seq" AS integer START WITH 0 MINVALUE 0 INCREMENT BY 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP SEQUENCE IF EXISTS "wallet_derivation_index_seq"`,
    );
  }
}
