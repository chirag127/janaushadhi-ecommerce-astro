export type Currency = "INR" | "USD" | "EUR" | "GBP";

export const CURRENCIES: Currency[] = ["INR", "USD", "EUR", "GBP"];
export const DEFAULT_CURRENCY: Currency = "INR";

/**
 * Static display-only conversion rates relative to INR.
 * Razorpay checkout always settles in INR; these are for browsing only.
 * (Update periodically or wire to a rates API if needed.)
 */
export const RATES: Record<Currency, number> = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
};

const SYMBOLS: Record<Currency, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

const LOCALE_MAP: Record<Currency, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
};

export function isCurrency(v: string | undefined): v is Currency {
  return v === "INR" || v === "USD" || v === "EUR" || v === "GBP";
}

/**
 * Convert an INR amount to the target currency (display only).
 */
export function convert(amountInr: number, to: Currency): number {
  return amountInr * RATES[to];
}

/**
 * Format an INR-denominated amount for display in the chosen currency.
 */
export function formatMoney(amountInr: number, currency: Currency): string {
  const value = convert(amountInr, currency);
  try {
    return new Intl.NumberFormat(LOCALE_MAP[currency], {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${SYMBOLS[currency]}${value.toFixed(2)}`;
  }
}

export function currencySymbol(currency: Currency): string {
  return SYMBOLS[currency];
}
