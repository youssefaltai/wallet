/**
 * FX rate service — daily exchange rates from Open Exchange Rates.
 *
 * Rates are cached in the exchange_rates table (one row per day).
 * OXR publishes rates hourly with USD as the base currency (free plan).
 * The convert functions handle any currency pair by cross-converting through USD.
 *
 * Requires env var: OPEN_EXCHANGE_RATES_APP_ID
 */

import { db } from "@/lib/db";
import { exchangeRates } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getMinorUnitFactor } from "@/lib/constants/currencies";

// ── Types ────────────────────────────────────────────────────────────────

/** Rates object: currency code → rate relative to USD (USD = 1.0 implicitly). */
export type Rates = Record<string, number>;

// ── In-memory request-level cache ────────────────────────────────────────

interface CacheEntry {
  rates: Rates;
  fetchedAt: number;
}

const memoryCache = new Map<string, CacheEntry>();

/** TTL for "latest" rates — 1 hour. Dated rates are immutable. */
const LATEST_TTL_MS = 60 * 60 * 1000;

// ── Fetch & cache ────────────────────────────────────────────────────────

/** Return type for getRatesWithMeta — rates plus when they were fetched. */
export interface RatesWithMeta {
  rates: Rates;
  fetchedAt: Date;
}

/**
 * Get exchange rates for a given date (defaults to latest).
 * Checks in-memory cache → DB cache → API, in that order.
 */
export async function getRates(date?: string): Promise<Rates> {
  const cacheKey = date ?? "latest";

  // 1. In-memory cache
  const cached = memoryCache.get(cacheKey);
  if (cached) {
    const isStale = cacheKey === "latest" && Date.now() - cached.fetchedAt > LATEST_TTL_MS;
    if (!isStale) return cached.rates;
  }

  // 2. DB cache
  if (date) {
    const [row] = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.baseCurrency, "USD"),
          eq(exchangeRates.date, date),
        ),
      )
      .limit(1);
    if (row) {
      memoryCache.set(cacheKey, { rates: row.rates, fetchedAt: Date.now() });
      return row.rates;
    }
  } else {
    // For "latest", check if we have today's rates
    const today = new Date().toISOString().slice(0, 10);
    const [row] = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.baseCurrency, "USD"),
          eq(exchangeRates.date, today),
        ),
      )
      .limit(1);
    if (row) {
      memoryCache.set(cacheKey, { rates: row.rates, fetchedAt: Date.now() });
      return row.rates;
    }
  }

  // 3. Fetch from API
  const rates = await fetchFromApi(date);

  // 4. Fallback: if API failed, use most recent cached rates
  if (!rates) {
    const [fallback] = await db
      .select()
      .from(exchangeRates)
      .where(eq(exchangeRates.baseCurrency, "USD"))
      .orderBy(desc(exchangeRates.date))
      .limit(1);
    if (fallback) {
      memoryCache.set(cacheKey, { rates: fallback.rates, fetchedAt: Date.now() });
      return fallback.rates;
    }
    throw new Error("No exchange rates available. Check your internet connection.");
  }

  memoryCache.set(cacheKey, { rates, fetchedAt: Date.now() });
  return rates;
}

/**
 * Same as getRates() but also returns when the rates were fetched.
 * Use this when callers need to surface the "rates fetched at" timestamp
 * (e.g. labeling approximate net worth figures on the dashboard).
 */
export async function getRatesWithMeta(date?: string): Promise<RatesWithMeta> {
  const rates = await getRates(date);
  const cacheKey = date ?? "latest";
  const cached = memoryCache.get(cacheKey);
  // fetchedAt is stored as a unix timestamp (ms) in the cache entry
  const fetchedAt = cached ? new Date(cached.fetchedAt) : new Date();
  return { rates, fetchedAt };
}

async function fetchFromApi(date?: string): Promise<Rates | null> {
  const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID;
  if (!appId) {
    console.warn("OPEN_EXCHANGE_RATES_APP_ID not set — cannot fetch exchange rates");
    return null;
  }

  const endpoint = date
    ? `https://openexchangerates.org/api/historical/${date}.json?app_id=${appId}`
    : `https://openexchangerates.org/api/latest.json?app_id=${appId}`;

  try {
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 3600 }, // Next.js: cache for 1 hour
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      base: string;
      timestamp: number;
      rates: Rates;
    };

    // OXR returns the date as a unix timestamp; derive YYYY-MM-DD
    const rateDate = date ?? new Date(data.timestamp * 1000).toISOString().slice(0, 10);

    // Persist to DB (upsert)
    await db
      .insert(exchangeRates)
      .values({
        baseCurrency: data.base, // "USD"
        date: rateDate,
        rates: data.rates,
      })
      .onConflictDoNothing();

    return data.rates;
  } catch {
    return null;
  }
}

// ── Conversion ───────────────────────────────────────────────────────────

/**
 * Convert a major-units amount between two currencies.
 * Uses USD as the implicit cross base (since all rates are USD-relative).
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: Rates,
): number {
  if (from === to) return amount;

  // USD rate is implicitly 1.0 — not in the rates object
  const fromRate = from === "USD" ? 1 : rates[from];
  const toRate = to === "USD" ? 1 : rates[to];

  if (fromRate === undefined || toRate === undefined) {
    throw new Error(`Missing exchange rate for ${fromRate === undefined ? from : to}`);
  }
  if (fromRate <= 0 || toRate <= 0) {
    throw new Error(`Invalid exchange rate: ${from}=${fromRate}, ${to}=${toRate}`);
  }

  // amount in USD = amount / fromRate
  // amount in target = amountInUsd * toRate
  return (amount / fromRate) * toRate;
}

/**
 * Convert minor units from one currency to another.
 * Handles different minor unit factors (e.g. JPY=1, USD=100, BHD=1000).
 */
export function convertMinorUnits(
  amount: bigint,
  fromCurrency: string,
  toCurrency: string,
  rates: Rates,
): bigint {
  if (fromCurrency === toCurrency) return amount;

  const fromFactor = getMinorUnitFactor(fromCurrency);
  const toFactor = getMinorUnitFactor(toCurrency);

  // Convert to major units in source currency, cross-convert, then back to minor
  const majorFrom = Number(amount) / fromFactor;
  const majorTo = convert(majorFrom, fromCurrency, toCurrency, rates);
  return BigInt(Math.round(majorTo * toFactor));
}

/**
 * Check if conversion between two currencies is possible with available rates.
 */
export function canConvert(from: string, to: string, rates: Rates): boolean {
  if (from === to) return true;
  const fromRate = from === "USD" ? 1 : rates[from];
  const toRate = to === "USD" ? 1 : rates[to];
  return fromRate !== undefined && toRate !== undefined;
}

/**
 * Convert amount, returning null if rates are unavailable.
 */
export function tryConvert(
  amount: number,
  from: string,
  to: string,
  rates: Rates,
): number | null {
  if (from === to) return amount;
  const fromRate = from === "USD" ? 1 : rates[from];
  const toRate = to === "USD" ? 1 : rates[to];
  if (fromRate === undefined || toRate === undefined) return null;
  return (amount / fromRate) * toRate;
}
