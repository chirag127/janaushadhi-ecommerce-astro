/**
 * Client-side API helpers (browser). Talk to the app's own API routes.
 * Extended with product fetch endpoints for cart/wishlist/checkout views.
 */
async function fetchJSON<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

async function post<T = unknown>(url: string, body: unknown): Promise<T> {
  return fetchJSON<T>(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function del(url: string): Promise<void> {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
}

export const cartApi = {
  add: (productId: string, quantity = 1) =>
    post("/api/cart", { productId, quantity }),
  update: (productId: string, quantity: number) =>
    post("/api/cart/update", { productId, quantity }),
  remove: (productId: string) => del(`/api/cart/${productId}`),
};

export const wishlistApi = {
  toggle: (productId: string) =>
    post<{ added: boolean }>("/api/wishlist", { productId }),
  remove: (productId: string) => del(`/api/wishlist/${productId}`),
};

export const reviewApi = {
  submit: (productId: string, rating: number, title: string, comment: string) =>
    post("/api/reviews", { productId, rating, title, comment }),
};

/** Fetch product data for given IDs via public API endpoint */
export async function fetchProductsByIds(ids: string[]): Promise<unknown[]> {
  if (!ids.length) return [];
  const params = new URLSearchParams();
  ids.forEach((id) => params.append("id", id));
  const res = await fetch(`/api/products?${params.toString()}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { products?: unknown[] };
  return data.products ?? [];
}
