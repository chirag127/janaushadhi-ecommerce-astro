import type { APIRoute } from "astro";
import { createInsForgeServer } from "@lib/insforge/server";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Add (upsert) an item to the authenticated user's cart.
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!locals.user) return json({ error: "Not authenticated" }, 401);
  const { productId, quantity = 1 } = (await request
    .json()
    .catch(() => ({}))) as { productId?: string; quantity?: number };
  if (!productId) return json({ error: "productId required" }, 400);

  const insforge = createInsForgeServer(cookies, locals);
  const uid = locals.user.id;

  // fetch existing
  const { data: existing } = await insforge.database
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", uid)
    .eq("product_id", productId)
    .maybeSingle();

  const row = existing as { id: string; quantity: number } | null;
  if (row) {
    const { error } = await insforge.database
      .from("cart_items")
      .update({ quantity: row.quantity + quantity })
      .eq("id", row.id);
    if (error) return json({ error: error.message }, 400);
  } else {
    const { error } = await insforge.database
      .from("cart_items")
      .insert([{ user_id: uid, product_id: productId, quantity }]);
    if (error) return json({ error: error.message }, 400);
  }
  return json({ ok: true });
};
