import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reserve BIP-44 index 0 for the master hot wallet.
 *
 * User deposit addresses are derived from the SAME master mnemonic, so index 0
 * (the master/treasury account) must never be handed to a user — otherwise a
 * user's deposit address would equal the master wallet. This:
 *   1. removes any wallet already sitting at index 0 (it will be re-provisioned
 *      at a safe index on the user's next request — get-or-create), and
 *   2. advances the sequence so the next allocation is >= 1.
 */
export class ReserveMasterWalletIndex1784300000000 implements MigrationInterface {
  name = 'ReserveMasterWalletIndex1784300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Free index 0 (reserved for the master wallet).
    await queryRunner.query(
      `DELETE FROM "wallets" WHERE "derivation_index" = 0`,
    );

    // 2. Never hand out 0 again: next value is 1, or continues past any higher
    //    user indices already assigned. setval(..., false) => nextval returns it.
    await queryRunner.query(
      `SELECT setval('wallet_derivation_index_seq', GREATEST(1, COALESCE((SELECT MAX("derivation_index") FROM "wallets"), 0) + 1), false)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Non-reversible data change (deleted wallets can't be restored); only the
    // sequence position is rolled back to allow 0 again.
    await queryRunner.query(
      `SELECT setval('wallet_derivation_index_seq', 0, false)`,
    );
  }
}
