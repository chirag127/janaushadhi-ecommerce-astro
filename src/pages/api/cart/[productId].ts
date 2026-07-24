import type { APIRoute } from "astro";
import { getDb } from "@lib/db/client";
import { dbDeleteCartItem } from "@lib/db/repository";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Not authenticated" }, 401);
  const productId = params.productId;
  if (!productId) return json({ error: "productId required" }, 400);
  await dbDeleteCartItem(getDb(), locals.user.id, productId);
  return json({ ok: true });
};
