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
  return locals.user && locals.isAdmin;
}

const FIELDS = [
  "code",
  "description",
  "discount_type",
  "discount_value",
  "min_order_amount",
  "max_discount_amount",
  "usage_limit",
  "per_user_limit",
  "starts_at",
  "expires_at",
  "is_active",
];

function normalize(b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of FIELDS) {
    if (!(k in b)) continue;
    const v = b[k];
    if (v === "" || v === undefined) {
      out[k] = null;
      continue;
    }
    if (
      k === "discount_value" ||
      k === "min_order_amount" ||
      k === "max_discount_amount"
    ) {
      out[k] = v === null ? null : Number(v);
    } else if (k === "usage_limit" || k === "per_user_limit") {
      out[k] = v === null ? null : Math.trunc(Number(v));
    } else {
      out[k] = v;
    }
  }
  return out;
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!guard(locals)) return json({ error: "Forbidden" }, 403);
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.code) return json({ error: "code required" }, 400);
  const insforge = createInsForgeServer(cookies, locals);
  const row = normalize(b);
  row.code = String(b.code).toUpperCase().trim();
  if (!("discount_type" in row)) row.discount_type = "percent";
  const { data, error } = await insforge.database
    .from("coupons")
    .insert([row])
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);
  return json({ coupon: data });
};

export const PUT: APIRoute = async ({ request, cookies, locals }) => {
  if (!guard(locals)) return json({ error: "Forbidden" }, 403);
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.id) return json({ error: "id required" }, 400);
  const insforge = createInsForgeServer(cookies, locals);
  const patch = normalize(b);
  if (patch.code) patch.code = String(patch.code).toUpperCase().trim();
  const { data, error } = await insforge.database
    .from("coupons")
    .update(patch)
    .eq("id", b.id as string)
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);
  return json({ coupon: data });
};

export const DELETE: APIRoute = async ({ request, cookies, locals }) => {
  if (!guard(locals)) return json({ error: "Forbidden" }, 403);
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return json({ error: "id required" }, 400);
  const insforge = createInsForgeServer(cookies, locals);
  const { error } = await insforge.database
    .from("coupons")
    .delete()
    .eq("id", id);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
};
