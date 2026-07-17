import { persistentAtom, persistentMap } from "@nanostores/persistent";
import { atom } from "nanostores";

/** Theme: light / dark, persisted. */
export const $theme = persistentAtom<"light" | "dark">("ja:theme", "light");

/** Locale + currency prefs, persisted. */
export const $prefs = persistentMap<{ locale: string; currency: string }>(
  "ja:prefs:",
  { locale: "en", currency: "INR" },
);

/** Local cart line: productId -> quantity (guest cart / optimistic UI). */
export const $cart = persistentMap<Record<string, string>>("ja:cart:", {});

/** Local wishlist: productId -> "1". */
export const $wishlist = persistentMap<Record<string, string>>(
  "ja:wishlist:",
  {},
);

/** Signed-in user id (null when guest). Set on hydration. */
export const $userId = atom<string | null>(null);

// ---- Cart helpers ----
export function cartAdd(productId: string, qty = 1) {
  const current = parseInt($cart.get()[productId] ?? "0", 10);
  $cart.setKey(productId, String(current + qty));
}

export function cartSet(productId: string, qty: number) {
  if (qty <= 0) $cart.setKey(productId, undefined as unknown as string);
  else $cart.setKey(productId, String(qty));
}

export function cartRemove(productId: string) {
  $cart.setKey(productId, undefined as unknown as string);
}

export function cartCount(): number {
  return Object.values($cart.get()).reduce(
    (sum, q) => sum + parseInt(q ?? "0", 10),
    0,
  );
}

export function cartClear() {
  const keys = Object.keys($cart.get());
  keys.forEach((k) => $cart.setKey(k, undefined as unknown as string));
}

// ---- Wishlist helpers ----
export function wishlistToggle(productId: string): boolean {
  const has = Boolean($wishlist.get()[productId]);
  if (has) {
    $wishlist.setKey(productId, undefined as unknown as string);
    return false;
  }
  $wishlist.setKey(productId, "1");
  return true;
}

export function wishlistHas(productId: string): boolean {
  return Boolean($wishlist.get()[productId]);
}

export function wishlistCount(): number {
  return Object.keys($wishlist.get()).filter((k) => $wishlist.get()[k]).length;
}
