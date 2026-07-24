import type { APIRoute } from "astro";
import { getDb } from "@lib/db/client";
import { reviews as reviewsT } from "@lib/db/schema";
import { and, eq } from "drizzle-orm";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Not authenticated" }, 401);
  const { productId, rating, title, comment } = (await request
    .json()
    .catch(() => ({}))) as {
    productId?: string;
    rating?: number;
    title?: string;
    comment?: string;
  };
  if (!productId || !rating || rating < 1 || rating > 5) {
    return json({ error: "productId and rating (1-5) required" }, 400);
  }

  try {
    const db = getDb();
    // Upsert on (product_id, user_id)
    await db
      .insert(reviewsT)
      .values({
        product_id: productId,
        user_id: locals.user.id,
        rating,
        title: title ?? null,
        comment: comment ?? null,
      })
      .onConflictDoUpdate({
        target: [reviewsT.product_id, reviewsT.user_id],
        set: { rating, title: title ?? null, comment: comment ?? null },
      });
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
