import type { APIRoute } from "astro";
import { createInsForgeServer } from "@lib/insforge/server";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
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

  const insforge = createInsForgeServer(cookies, locals);
  const { error } = await insforge.database.from("reviews").upsert(
    [
      {
        product_id: productId,
        user_id: locals.user.id,
        rating,
        title: title ?? null,
        comment: comment ?? null,
      },
    ],
    { onConflict: "product_id,user_id" },
  );
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
};
