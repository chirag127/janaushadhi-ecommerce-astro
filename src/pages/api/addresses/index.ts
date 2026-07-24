import type { APIRoute } from "astro";
import { getDb } from "@lib/db/client";
import {
  dbGetAddressesByUser,
  dbInsertAddress,
  dbClearDefaultAddresses,
} from "@lib/db/repository";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  try {
    const addresses = await dbGetAddressesByUser(getDb(), locals.user.id);
    return json({ addresses });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.full_name || !b.phone || !b.line1 || !b.city || !b.state || !b.pincode) {
    return json(
      { error: "full_name, phone, line1, city, state, pincode are required" },
      400,
    );
  }

  try {
    const db = getDb();
    const userId = locals.user.id;
    if (b.is_default === true) await dbClearDefaultAddresses(db, userId);
    const address = await dbInsertAddress(db, {
      user_id: userId,
      full_name: b.full_name as string,
      phone: b.phone as string,
      line1: b.line1 as string,
      line2: (b.line2 as string) ?? null,
      city: b.city as string,
      state: b.state as string,
      pincode: b.pincode as string,
      country: (b.country as string) ?? "India",
      is_default: b.is_default === true,
    });
    return json({ address }, 201);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
