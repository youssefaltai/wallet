/**
 * Money conversion utilities.
 *
 * Internal: all money stored as bigint minor units (cents).
 * External: AI tools and UI work with normal decimal numbers.
 *
 * $50.00 → 5000n (internal)
 * 5000n → 50.00 (external)
 */

const MINOR_UNIT_FACTOR = 100;

/** Convert a human-readable amount (50.00) to minor units (5000n). */
export function toMinorUnits(major: number): bigint {
  // Round to avoid floating-point issues: 19.99 * 100 = 1998.9999...
  return BigInt(Math.round(major * MINOR_UNIT_FACTOR));
}

/** Convert minor units (5000n) to a human-readable number (50.00). */
export function toMajorUnits(minor: bigint): number {
  return Number(minor) / MINOR_UNIT_FACTOR;
}

/** Format minor units as a display string like "$50.00". */
export function formatMoney(
  minor: bigint,
  currency = "USD",
  locale = "en-US",
): string {
  const major = toMajorUnits(minor);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(major);
}
