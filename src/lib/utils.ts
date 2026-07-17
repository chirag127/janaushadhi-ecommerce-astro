export const FREE_SHIPPING_THRESHOLD = 500; // INR
export const FLAT_SHIPPING = 40; // INR

export function computeShipping(subtotalInr: number): number {
  if (subtotalInr <= 0) return 0;
  return subtotalInr >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
}

export function generateOrderNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `JA-${ymd}-${rand}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 90);
}

export function truncate(text: string, len = 120): string {
  if (text.length <= len) return text;
  return text.slice(0, len).trimEnd() + "…";
}

export function formatDate(iso: string, locale = "en-IN"): string {
  return new Date(iso).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Discount percent of price vs mrp. */
export function discountPct(mrp: number, price: number): number {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

export function classNames(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
