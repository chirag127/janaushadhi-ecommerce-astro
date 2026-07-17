import type { APIRoute } from "astro";
import { createInsForgeServer } from "@lib/insforge/server";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Toggle a product in the user's wishlist.
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!locals.user) return json({ error: "Not authenticated" }, 401);
  const { productId } = (await request.json().catch(() => ({}))) as {
    productId?: string;
  };
  if (!productId) return json({ error: "productId required" }, 400);

  const insforge = createInsForgeServer(cookies, locals);
  const uid = locals.user.id;

  const { data: existing } = await insforge.database
    .from("wishlist_items")
    .select("id")
    .eq("user_id", uid)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    await insforge.database
      .from("wishlist_items")
      .delete()
      .eq("id", (existing as { id: string }).id);
    return json({ added: false });
  }
  const { error } = await insforge.database
    .from("wishlist_items")
    .insert([{ user_id: uid, product_id: productId }]);
  if (error) return json({ error: error.message }, 400);
  return json({ added: true });
};
