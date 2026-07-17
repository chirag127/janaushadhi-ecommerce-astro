/**
 * Client-side API helpers (browser). Talk to the app's own API routes,
 * which use the InsForge server client with the user's session cookie.
 */
async function post<T = unknown>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
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
