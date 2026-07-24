import type { APIRoute } from "astro";
import { getDb } from "@lib/db/client";
import { dbUpdateCartItemQty, dbDeleteCartItem } from "@lib/db/repository";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Not authenticated" }, 401);
  const { productId, quantity } = (await request.json().catch(() => ({}))) as {
    productId?: string;
    quantity?: number;
  };
  if (!productId || typeof quantity !== "number") {
    return json({ error: "productId and quantity required" }, 400);
  }

  const db = getDb();
  const uid = locals.user.id;

  if (quantity <= 0) {
    await dbDeleteCartItem(db, uid, productId);
    return json({ ok: true, removed: true });
  }
  await dbUpdateCartItemQty(db, uid, productId, quantity);
  return json({ ok: true });
};
