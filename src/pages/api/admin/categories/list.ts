import type { APIRoute } from "astro";
import { getDb } from "@lib/db/client";
import { dbGetCategories } from "@lib/db/repository";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user || !locals.isAdmin) return json({ error: "Forbidden" }, 403);
  try {
    const categories = await dbGetCategories(getDb());
    return json({ categories });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
