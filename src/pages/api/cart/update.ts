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
  const { productId, quantity } = (await request.json().catch(() => ({}))) as {
    productId?: string;
    quantity?: number;
  };
  if (!productId || typeof quantity !== "number") {
    return json({ error: "productId and quantity required" }, 400);
  }

  const insforge = createInsForgeServer(cookies, locals);
  const uid = locals.user.id;

  if (quantity <= 0) {
    await insforge.database
      .from("cart_items")
      .delete()
      .eq("user_id", uid)
      .eq("product_id", productId);
    return json({ ok: true, removed: true });
  }

  const { error } = await insforge.database
    .from("cart_items")
    .update({ quantity })
    .eq("user_id", uid)
    .eq("product_id", productId);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
};
