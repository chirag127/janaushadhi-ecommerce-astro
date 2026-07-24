import type { APIRoute } from "astro";
import { getDb } from "@lib/db/client";
import {
  dbGetAllCoupons,
  dbInsertCoupon,
  dbUpdateCoupon,
  dbDeleteCoupon,
} from "@lib/db/repository";

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
  "code", "description", "discount_type", "discount_value",
  "min_order_amount", "max_discount_amount", "usage_limit", "per_user_limit",
  "starts_at", "expires_at", "is_active",
] as const;

function normalize(b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of FIELDS) {
    if (!(k in b)) continue;
    const v = b[k];
    if (v === "" || v === undefined) { out[k] = null; continue; }
    if (k === "discount_value" || k === "min_order_amount" || k === "max_discount_amount") {
      out[k] = v === null ? null : String(Number(v));
    } else if (k === "usage_limit" || k === "per_user_limit") {
      out[k] = v === null ? null : Math.trunc(Number(v));
    } else {
      out[k] = v;
    }
  }
  return out;
}

export const GET: APIRoute = async ({ locals }) => {
  if (!guard(locals)) return json({ error: "Forbidden" }, 403);
  try {
    const coupons = await dbGetAllCoupons(getDb());
    return json({ coupons });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!guard(locals)) return json({ error: "Forbidden" }, 403);
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.code) return json({ error: "code required" }, 400);
  try {
    const row = normalize(b) as Record<string, unknown>;
    row.code = String(b.code).toUpperCase().trim();
    if (!("discount_type" in row)) row.discount_type = "percent";
    if (!("discount_value" in row)) row.discount_value = "0";
    const coupon = await dbInsertCoupon(getDb(), row as Parameters<typeof dbInsertCoupon>[1]);
    return json({ coupon });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  if (!guard(locals)) return json({ error: "Forbidden" }, 403);
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.id) return json({ error: "id required" }, 400);
  try {
    const patch = normalize(b);
    if (patch.code) patch.code = String(patch.code).toUpperCase().trim();
    const coupon = await dbUpdateCoupon(getDb(), b.id as string, patch as Parameters<typeof dbUpdateCoupon>[2]);
    if (!coupon) return json({ error: "Coupon not found" }, 404);
    return json({ coupon });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  if (!guard(locals)) return json({ error: "Forbidden" }, 403);
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return json({ error: "id required" }, 400);
  try {
    await dbDeleteCoupon(getDb(), id);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
