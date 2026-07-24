import type { APIRoute } from "astro";
import { getDb } from "@lib/db/client";
import {
  dbGetWishlistItem,
  dbAddWishlistItem,
  dbDeleteWishlistItem,
} from "@lib/db/repository";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Not authenticated" }, 401);
  const { productId } = (await request.json().catch(() => ({}))) as {
    productId?: string;
  };
  if (!productId) return json({ error: "productId required" }, 400);

  const db = getDb();
  const uid = locals.user.id;
  const existing = await dbGetWishlistItem(db, uid, productId);

  if (existing) {
    await dbDeleteWishlistItem(db, uid, productId);
    return json({ added: false });
  }
  await dbAddWishlistItem(db, uid, productId);
  return json({ added: true });
};
