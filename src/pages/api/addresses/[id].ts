import type { APIRoute } from "astro";
import { createInsForgeServer } from "@lib/insforge/server";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function guard(locals: App.Locals) {
  return !!locals.user;
}

// PUT /api/addresses/[id] — update an address
export const PUT: APIRoute = async ({ request, params, cookies, locals }) => {
  if (!guard(locals)) return json({ error: "Unauthorized" }, 401);
  const { id } = params;
  if (!id) return json({ error: "id required" }, 400);

  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const insforge = createInsForgeServer(cookies, locals);
  const userId = locals.user!.id;

  // If setting as default, clear existing defaults first
  if (b.is_default === true) {
    await insforge.database
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", userId);
  }

  const patch: Record<string, unknown> = {};
  for (const key of [
    "full_name",
    "phone",
    "line1",
    "line2",
    "city",
    "state",
    "pincode",
    "country",
    "is_default",
  ]) {
    if (key in b) patch[key] = b[key];
  }

  const { data, error } = await insforge.database
    .from("addresses")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId) // belt-and-suspenders; RLS also enforces
    .select()
    .single();

  if (error) return json({ error: error.message }, 400);
  return json({ address: data });
};

// DELETE /api/addresses/[id] — delete an address
export const DELETE: APIRoute = async ({ params, cookies, locals }) => {
  if (!guard(locals)) return json({ error: "Unauthorized" }, 401);
  const { id } = params;
  if (!id) return json({ error: "id required" }, 400);

  const insforge = createInsForgeServer(cookies, locals);
  const { error } = await insforge.database
    .from("addresses")
    .delete()
    .eq("id", id)
    .eq("user_id", locals.user!.id); // belt-and-suspenders; RLS also enforces

  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
};
