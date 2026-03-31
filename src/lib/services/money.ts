/**
 * Money conversion utilities.
 *
 * Internal: all money stored as bigint minor units.
 * External: AI tools and UI work with normal decimal numbers.
 *
 * The minor unit factor is currency-dependent:
 *   USD $50.00 → 5000n  (factor 100)
 *   JPY ¥1000  → 1000n  (factor 1)
 *   BHD 1.500  → 1500n  (factor 1000)
 */

import { getMinorUnitFactor } from "@/lib/constants/currencies";

/** Convert a human-readable amount (50.00) to minor units (5000n). */
export function toMinorUnits(major: number, currency = "USD"): bigint {
  const factor = getMinorUnitFactor(currency);
  // Round to avoid floating-point issues: 19.99 * 100 = 1998.9999...
  return BigInt(Math.round(major * factor));
}

/** Convert minor units (5000n) to a human-readable number (50.00). */
export function toMajorUnits(minor: bigint, currency = "USD"): number {
  const factor = getMinorUnitFactor(currency);
  return Number(minor) / factor;
}

/** Format minor units as a display string like "$50.00". */
export function formatMoney(
  minor: bigint,
  currency = "USD",
  locale = "en-US",
): string {
  const major = toMajorUnits(minor, currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(major);
}
