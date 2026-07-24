import type { APIRoute } from "astro";
import { getDb } from "@lib/db/client";
import {
  dbInsertProduct,
  dbUpdateProduct,
  dbDeleteProduct,
} from "@lib/db/repository";
import { slugify } from "@lib/utils";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function guard(locals: App.Locals) {
  return locals.user && locals.isAdmin;
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!guard(locals)) return json({ error: "Forbidden" }, 403);
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.name) return json({ error: "name required" }, 400);
  try {
    const product = await dbInsertProduct(getDb(), {
      name: b.name as string,
      slug: (b.slug as string) || slugify(b.name as string),
      drug_code: (b.drug_code as string) ?? null,
      description: (b.description as string) ?? null,
      category_id: (b.category_id as string) ?? null,
      unit_size: (b.unit_size as string) ?? null,
      mrp: String(Number(b.mrp ?? 0)),
      price: String(Number(b.price ?? 0)),
      stock: Number(b.stock ?? 0),
      image_url: (b.image_url as string) ?? null,
      is_active: (b.is_active as boolean) ?? true,
      is_featured: (b.is_featured as boolean) ?? false,
    });
    return json({ product });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  if (!guard(locals)) return json({ error: "Forbidden" }, 403);
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.id) return json({ error: "id required" }, 400);
  try {
    const patch: Record<string, unknown> = {};
    for (const key of [
      "name", "slug", "drug_code", "description", "category_id", "unit_size",
      "mrp", "price", "stock", "image_url", "is_active", "is_featured",
    ]) {
      if (key in b) {
        if (key === "mrp" || key === "price") patch[key] = String(Number(b[key]));
        else patch[key] = b[key];
      }
    }
    const product = await dbUpdateProduct(getDb(), b.id as string, patch);
    if (!product) return json({ error: "Product not found" }, 404);
    return json({ product });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  if (!guard(locals)) return json({ error: "Forbidden" }, 403);
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return json({ error: "id required" }, 400);
  try {
    await dbDeleteProduct(getDb(), id);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
