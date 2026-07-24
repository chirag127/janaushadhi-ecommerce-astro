import type { APIRoute } from "astro";
import { getDb } from "@lib/db/client";
import { products as productsT } from "@lib/db/schema";
import { ilike, desc, and } from "drizzle-orm";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user || !locals.isAdmin) return json({ error: "Forbidden" }, 403);
  const page = Math.max(0, parseInt(url.searchParams.get("page") ?? "0", 10) || 0);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const PAGE = 20;
  try {
    const db = getDb();
    const base = db.select().from(productsT).orderBy(desc(productsT.created_at));
    const filtered = q
      ? base.where(ilike(productsT.name, `%${q}%`))
      : base;
    const rows = await filtered.limit(PAGE).offset(page * PAGE);

    // count
    const { count: drizzleCount } = await import("drizzle-orm");
    const countBase = db.select({ c: drizzleCount() }).from(productsT);
    const countRows = q
      ? await countBase.where(ilike(productsT.name, `%${q}%`))
      : await countBase;
    const total = Number(countRows[0]?.c ?? 0);

    const products = rows.map((r) => ({
      ...r,
      mrp: parseFloat(r.mrp as string) || 0,
      price: parseFloat(r.price as string) || 0,
      created_at: (r.created_at as Date).toISOString(),
      updated_at: (r.updated_at as Date).toISOString(),
    }));
    return json({ products, total });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
