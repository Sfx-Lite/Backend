/**
 * Default fee configuration.
 *
 * In production these values will eventually
 * come from the database or environment.
 */

export const FEE_CONFIG = {
  /**
   * Fixed fee charged per transaction.
   */
  FIXED_FEE: 100,

  /**
   * Percentage fee.
   */
  PERCENTAGE_FEE: 1.5,

  /**
   * Maximum fee allowed.
   */
  MAX_FEE: 5000,

  /**
   * Minimum fee.
   */
  MIN_FEE: 50,
};
