import type { APIRoute } from "astro";
import { getDb } from "@lib/db/client";
import { dbGetOrdersAndItems } from "@lib/db/repository";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user || !locals.isAdmin) return json({ error: "Forbidden" }, 403);
  const status = url.searchParams.get("status") || null;
  try {
    const orders = await dbGetOrdersAndItems(getDb(), status, 200);
    return json({ orders });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
