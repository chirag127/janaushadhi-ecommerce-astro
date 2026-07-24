import type { APIRoute } from "astro";
import { getDb } from "@lib/db/client";
import {
  dbInsertCategory,
  dbUpdateCategory,
  dbDeleteCategory,
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
    const category = await dbInsertCategory(getDb(), {
      name: b.name as string,
      slug: (b.slug as string) || slugify(b.name as string),
      description: (b.description as string) ?? null,
      image_url: (b.image_url as string) ?? null,
      sort_order: Number(b.sort_order ?? 0),
    });
    return json({ category });
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
    for (const k of ["name", "slug", "description", "image_url", "sort_order"]) {
      if (k in b) patch[k] = b[k];
    }
    const category = await dbUpdateCategory(getDb(), b.id as string, patch);
    if (!category) return json({ error: "Category not found" }, 404);
    return json({ category });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  if (!guard(locals)) return json({ error: "Forbidden" }, 403);
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return json({ error: "id required" }, 400);
  try {
    await dbDeleteCategory(getDb(), id);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
