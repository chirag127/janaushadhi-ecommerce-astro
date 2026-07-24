import type { APIRoute } from "astro";
import { getDb } from "@lib/db/client";
import {
  dbUpdateAddress,
  dbDeleteAddress,
  dbClearDefaultAddresses,
} from "@lib/db/repository";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const PUT: APIRoute = async ({ request, params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  const { id } = params;
  if (!id) return json({ error: "id required" }, 400);

  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const db = getDb();
    const userId = locals.user.id;
    if (b.is_default === true) await dbClearDefaultAddresses(db, userId);

    const patch: Record<string, unknown> = {};
    for (const key of [
      "full_name", "phone", "line1", "line2", "city", "state", "pincode",
      "country", "is_default",
    ]) {
      if (key in b) patch[key] = b[key];
    }
    const address = await dbUpdateAddress(db, id, userId, patch);
    if (!address) return json({ error: "Address not found" }, 404);
    return json({ address });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  const { id } = params;
  if (!id) return json({ error: "id required" }, 400);
  try {
    await dbDeleteAddress(getDb(), id, locals.user.id);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
