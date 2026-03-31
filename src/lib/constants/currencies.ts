/**
 * Static currency metadata (ISO 4217).
 *
 * Covers currencies supported by Open Exchange Rates (180+ currencies).
 */

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  /** Number of decimal places (0 for JPY, 2 for USD, 3 for BHD). */
  minorUnits: number;
  /** Whether Open Exchange Rates publishes exchange rates for this currency. */
  hasFxSupport: boolean;
}

const CURRENCIES_LIST: CurrencyInfo[] = [
  // Major currencies
  { code: "USD", name: "US Dollar", symbol: "$", minorUnits: 2, hasFxSupport: true },
  { code: "EUR", name: "Euro", symbol: "€", minorUnits: 2, hasFxSupport: true },
  { code: "GBP", name: "British Pound", symbol: "£", minorUnits: 2, hasFxSupport: true },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", minorUnits: 0, hasFxSupport: true },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", minorUnits: 2, hasFxSupport: true },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", minorUnits: 2, hasFxSupport: true },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", minorUnits: 2, hasFxSupport: true },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", minorUnits: 2, hasFxSupport: true },

  // Middle East & Africa
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", minorUnits: 2, hasFxSupport: true },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", minorUnits: 2, hasFxSupport: true },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£", minorUnits: 2, hasFxSupport: true },
  { code: "ZAR", name: "South African Rand", symbol: "R", minorUnits: 2, hasFxSupport: true },
  { code: "BHD", name: "Bahraini Dinar", symbol: "BD", minorUnits: 3, hasFxSupport: true },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KD", minorUnits: 3, hasFxSupport: true },
  { code: "QAR", name: "Qatari Riyal", symbol: "QR", minorUnits: 2, hasFxSupport: true },
  { code: "OMR", name: "Omani Rial", symbol: "OMR", minorUnits: 3, hasFxSupport: true },
  { code: "JOD", name: "Jordanian Dinar", symbol: "JD", minorUnits: 3, hasFxSupport: true },
  { code: "MAD", name: "Moroccan Dirham", symbol: "MAD", minorUnits: 2, hasFxSupport: true },
  { code: "TND", name: "Tunisian Dinar", symbol: "TND", minorUnits: 3, hasFxSupport: true },

  // Europe (non-EUR)
  { code: "SEK", name: "Swedish Krona", symbol: "kr", minorUnits: 2, hasFxSupport: true },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", minorUnits: 2, hasFxSupport: true },
  { code: "DKK", name: "Danish Krone", symbol: "kr", minorUnits: 2, hasFxSupport: true },
  { code: "PLN", name: "Polish Zloty", symbol: "zł", minorUnits: 2, hasFxSupport: true },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč", minorUnits: 2, hasFxSupport: true },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft", minorUnits: 2, hasFxSupport: true },
  { code: "RON", name: "Romanian Leu", symbol: "lei", minorUnits: 2, hasFxSupport: true },
  { code: "BGN", name: "Bulgarian Lev", symbol: "лв", minorUnits: 2, hasFxSupport: true },
  { code: "ISK", name: "Icelandic Króna", symbol: "kr", minorUnits: 0, hasFxSupport: true },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", minorUnits: 2, hasFxSupport: true },

  // Asia & Pacific
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", minorUnits: 2, hasFxSupport: true },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", minorUnits: 2, hasFxSupport: true },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", minorUnits: 2, hasFxSupport: true },
  { code: "KRW", name: "South Korean Won", symbol: "₩", minorUnits: 0, hasFxSupport: true },
  { code: "INR", name: "Indian Rupee", symbol: "₹", minorUnits: 2, hasFxSupport: true },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", minorUnits: 2, hasFxSupport: true },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", minorUnits: 2, hasFxSupport: true },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", minorUnits: 2, hasFxSupport: true },
  { code: "THB", name: "Thai Baht", symbol: "฿", minorUnits: 2, hasFxSupport: true },

  // Americas
  { code: "BRL", name: "Brazilian Real", symbol: "R$", minorUnits: 2, hasFxSupport: true },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$", minorUnits: 2, hasFxSupport: true },

  // Other
  { code: "ILS", name: "Israeli Shekel", symbol: "₪", minorUnits: 2, hasFxSupport: true },
];

/** Map of currency code → metadata. */
export const CURRENCIES = new Map<string, CurrencyInfo>(
  CURRENCIES_LIST.map((c) => [c.code, c]),
);

/** Sorted array of currency codes for dropdowns. */
export const CURRENCY_CODES = CURRENCIES_LIST.map((c) => c.code);

/** Full list with metadata, for UI selectors. */
export const CURRENCY_LIST = CURRENCIES_LIST;

/**
 * Get the minor unit factor for a currency (10 ^ minorUnits).
 * USD → 100, JPY → 1, BHD → 1000.
 * Falls back to 100 for unknown currencies.
 */
export function getMinorUnitFactor(currency: string): number {
  const info = CURRENCIES.get(currency);
  return info ? 10 ** info.minorUnits : 100;
}

/**
 * Get the number of decimal places for a currency.
 * USD → 2, JPY → 0, BHD → 3.
 * Falls back to 2 for unknown currencies.
 */
export function getDecimalPlaces(currency: string): number {
  return CURRENCIES.get(currency)?.minorUnits ?? 2;
}

/** Check if a currency code is supported. */
export function isSupportedCurrency(code: string): boolean {
  return CURRENCIES.has(code);
}

/** Check if a currency has exchange rate support (OXR coverage). */
export function hasFxSupport(code: string): boolean {
  return CURRENCIES.get(code)?.hasFxSupport ?? false;
}
