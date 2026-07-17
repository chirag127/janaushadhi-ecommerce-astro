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

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!guard(locals)) return json({ error: "Forbidden" }, 403);
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.name) return json({ error: "name required" }, 400);
  const insforge = createInsForgeServer(cookies, locals);
  const { data, error } = await insforge.database
    .from("categories")
    .insert([
      {
        name: b.name,
        slug: (b.slug as string) || slugify(b.name as string),
        description: b.description ?? null,
        image_url: b.image_url ?? null,
        sort_order: Number(b.sort_order ?? 0),
      },
    ])
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);
  return json({ category: data });
};

export const PUT: APIRoute = async ({ request, cookies, locals }) => {
  if (!guard(locals)) return json({ error: "Forbidden" }, 403);
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.id) return json({ error: "id required" }, 400);
  const insforge = createInsForgeServer(cookies, locals);
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "slug", "description", "image_url", "sort_order"]) {
    if (k in b) patch[k] = b[k];
  }
  const { data, error } = await insforge.database
    .from("categories")
    .update(patch)
    .eq("id", b.id as string)
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);
  return json({ category: data });
};

export const DELETE: APIRoute = async ({ request, cookies, locals }) => {
  if (!guard(locals)) return json({ error: "Forbidden" }, 403);
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return json({ error: "id required" }, 400);
  const insforge = createInsForgeServer(cookies, locals);
  const { error } = await insforge.database
    .from("categories")
    .delete()
    .eq("id", id);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
};
