import type { APIRoute } from "astro";
import { getDb } from "@lib/db/client";
import { dbGetProductsByIds } from "@lib/db/repository";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** GET /api/products?id=x&id=y — fetch products by IDs (public, for browser components) */
export const GET: APIRoute = async ({ url }) => {
  const ids = url.searchParams.getAll("id").filter(Boolean);
  if (!ids.length) return json({ products: [] });
  try {
    const products = await dbGetProductsByIds(getDb(), ids);
    return json({ products });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
