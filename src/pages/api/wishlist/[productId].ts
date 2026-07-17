import type { APIRoute } from "astro";
import { createInsForgeServer } from "@lib/insforge/server";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const DELETE: APIRoute = async ({ params, cookies, locals }) => {
  if (!locals.user) return json({ error: "Not authenticated" }, 401);
  const productId = params.productId;
  if (!productId) return json({ error: "productId required" }, 400);

  const insforge = createInsForgeServer(cookies, locals);
  const { error } = await insforge.database
    .from("wishlist_items")
    .delete()
    .eq("user_id", locals.user.id)
    .eq("product_id", productId);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
};
