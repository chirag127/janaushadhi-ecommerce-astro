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

// GET /api/addresses — list own addresses
export const GET: APIRoute = async ({ cookies, locals }) => {
  if (!guard(locals)) return json({ error: "Unauthorized" }, 401);

  const insforge = createInsForgeServer(cookies, locals);
  const { data, error } = await insforge.database
    .from("addresses")
    .select("id, full_name, phone, line1, line2, city, state, pincode, country, is_default, created_at")
    .eq("user_id", locals.user!.id)
    .order("created_at", { ascending: false });

  if (error) return json({ error: error.message }, 400);
  return json({ addresses: data ?? [] });
};

// POST /api/addresses — create a new address
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!guard(locals)) return json({ error: "Unauthorized" }, 401);

  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.full_name || !b.phone || !b.line1 || !b.city || !b.state || !b.pincode) {
    return json({ error: "full_name, phone, line1, city, state, pincode are required" }, 400);
  }

  const insforge = createInsForgeServer(cookies, locals);
  const userId = locals.user!.id;

  // If setting as default, clear existing defaults first
  if (b.is_default === true) {
    await insforge.database
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", userId);
  }

  const { data, error } = await insforge.database
    .from("addresses")
    .insert([
      {
        user_id: userId,
        full_name: b.full_name,
        phone: b.phone,
        line1: b.line1,
        line2: b.line2 ?? null,
        city: b.city,
        state: b.state,
        pincode: b.pincode,
        country: (b.country as string) ?? "India",
        is_default: b.is_default === true,
      },
    ])
    .select()
    .single();

  if (error) return json({ error: error.message }, 400);
  return json({ address: data }, 201);
};
