/**
 * money — exact decimal arithmetic for on-ledger amounts.
 *
 * Rule #1 of the fintech charter: money is `numeric`, never a float. Postgres
 * stores our amounts as `numeric(18,6)` and hands them back as strings; this
 * module keeps them as strings the whole way through, doing the maths on
 * integer "micro-units" (1 unit = 10^-6, i.e. 6 decimal places) via BigInt so
 * there is never a binary-floating-point rounding error.
 *
 *   "1.50"  ⇄  1_500_000n micro-units
 *
 * Everything the ledger, fee engine and transfer services need lives here so
 * money is handled ONE way across the whole backend.
 */

/** Decimal places we settle to. USDC on Polygon is 6dp, which is our ceiling. */
export const MONEY_SCALE = 6;

const SCALE_FACTOR = 10n ** BigInt(MONEY_SCALE);

/** Matches an optional sign, integer part, and up to MONEY_SCALE decimals. */
const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

/**
 * Parse a decimal string (or integer) into signed micro-units.
 * Throws on non-numeric input or more precision than we can settle.
 */
export function toMicros(value: string | number): bigint {
  const raw = typeof value === 'number' ? numberToString(value) : value.trim();

  if (!DECIMAL_RE.test(raw)) {
    throw new RangeError(`Invalid money amount: "${value}"`);
  }

  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ''] = unsigned.split('.');

  if (fraction.length > MONEY_SCALE) {
    throw new RangeError(
      `Amount "${value}" exceeds ${MONEY_SCALE} decimal places`,
    );
  }

  const paddedFraction = fraction.padEnd(MONEY_SCALE, '0');
  const micros = BigInt(whole) * SCALE_FACTOR + BigInt(paddedFraction);

  return negative ? -micros : micros;
}

/**
 * Format signed micro-units back into a fixed-scale decimal string, e.g.
 * 1_500_000n → "1.500000". Always MONEY_SCALE decimals so DB round-trips are
 * byte-stable.
 */
export function fromMicros(micros: bigint): string {
  const negative = micros < 0n;
  const abs = negative ? -micros : micros;

  const whole = abs / SCALE_FACTOR;
  const fraction = (abs % SCALE_FACTOR).toString().padStart(MONEY_SCALE, '0');

  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** a + b, as a fixed-scale decimal string. */
export function addMoney(a: string, b: string): string {
  return fromMicros(toMicros(a) + toMicros(b));
}

/** a - b, as a fixed-scale decimal string (may be negative). */
export function subtractMoney(a: string, b: string): string {
  return fromMicros(toMicros(a) - toMicros(b));
}

/** -1 if a < b, 0 if equal, 1 if a > b. Scale-independent ("1" == "1.000000"). */
export function compareMoney(a: string, b: string): -1 | 0 | 1 {
  const delta = toMicros(a) - toMicros(b);
  if (delta < 0n) return -1;
  if (delta > 0n) return 1;
  return 0;
}

/** True when the amount is strictly greater than zero. */
export function isPositiveMoney(value: string): boolean {
  return toMicros(value) > 0n;
}

/** Canonical fixed-scale form of any valid amount string ("2.5" → "2.500000"). */
export function normalizeMoney(value: string): string {
  return fromMicros(toMicros(value));
}

/** Zero, in canonical fixed-scale form. */
export const ZERO_MONEY = fromMicros(0n);

/**
 * Convert a JS number to a plain decimal string without exponent notation.
 * Used only at the boundary; prefer passing strings everywhere internally.
 */
function numberToString(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Invalid money amount: ${value}`);
  }
  // toFixed avoids "1e-7" style output; extra precision is caught by toMicros.
  return value.toFixed(MONEY_SCALE);
}
