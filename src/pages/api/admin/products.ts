import type { APIRoute } from "astro";
import { createInsForgeServer } from "@lib/insforge/server";
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

// Create a product
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!guard(locals)) return json({ error: "Forbidden" }, 403);
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.name) return json({ error: "name required" }, 400);

  const insforge = createInsForgeServer(cookies, locals);
  const slug = (b.slug as string) || slugify(b.name as string);
  const { data, error } = await insforge.database
    .from("products")
    .insert([
      {
        name: b.name,
        slug,
        drug_code: b.drug_code ?? null,
        description: b.description ?? null,
        category_id: b.category_id ?? null,
        unit_size: b.unit_size ?? null,
        mrp: Number(b.mrp ?? 0),
        price: Number(b.price ?? 0),
        stock: Number(b.stock ?? 0),
        image_url: b.image_url ?? null,
        is_active: b.is_active ?? true,
        is_featured: b.is_featured ?? false,
      },
    ])
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);
  return json({ product: data });
};

// Update a product
export const PUT: APIRoute = async ({ request, cookies, locals }) => {
  if (!guard(locals)) return json({ error: "Forbidden" }, 403);
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.id) return json({ error: "id required" }, 400);

  const insforge = createInsForgeServer(cookies, locals);
  const patch: Record<string, unknown> = {};
  for (const key of [
    "name",
    "slug",
    "drug_code",
    "description",
    "category_id",
    "unit_size",
    "mrp",
    "price",
    "stock",
    "image_url",
    "is_active",
    "is_featured",
  ]) {
    if (key in b) patch[key] = b[key];
  }
  const { data, error } = await insforge.database
    .from("products")
    .update(patch)
    .eq("id", b.id as string)
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);
  return json({ product: data });
};

// Delete a product
export const DELETE: APIRoute = async ({ request, cookies, locals }) => {
  if (!guard(locals)) return json({ error: "Forbidden" }, 403);
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return json({ error: "id required" }, 400);
  const insforge = createInsForgeServer(cookies, locals);
  const { error } = await insforge.database
    .from("products")
    .delete()
    .eq("id", id);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
};
