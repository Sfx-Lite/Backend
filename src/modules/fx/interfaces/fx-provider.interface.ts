/**
 * Every FX provider must implement this interface.
 *
 * This allows us to switch providers without changing
 * the rest of the application.
 */
export interface FxProvider {
  /**
   * Fetch exchange rates.
   */
  getRates(baseCurrency: string): Promise<Record<string, number>>;
}
