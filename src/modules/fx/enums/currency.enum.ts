/**
 * Supported informational display currencies (quoted against USD ≈ USDC).
 * Matches the SFx Lite Rates screen: NGN, TRY, EUR, GBP, ZAR, KES.
 */
export enum Currency {
  USD = 'USD',
  NGN = 'NGN',
  TRY = 'TRY',
  EUR = 'EUR',
  GBP = 'GBP',
  ZAR = 'ZAR',
  KES = 'KES',
}

/** Currencies we persist a rate for on each sync (USD is the base, rate 1). */
export const SUPPORTED_CURRENCIES: readonly Currency[] =
  Object.values(Currency);
