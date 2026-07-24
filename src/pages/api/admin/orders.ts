import type { APIRoute } from "astro";
import { getDb } from "@lib/db/client";
import { dbUpdateOrder } from "@lib/db/repository";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const PUT: APIRoute = async ({ request, locals }) => {
  if (!locals.user || !locals.isAdmin) return json({ error: "Forbidden" }, 403);
  const { id, status } = (await request.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
  };
  const valid = [
    "pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded",
  ];
  if (!id || !status || !valid.includes(status)) {
    return json({ error: "Valid id and status required" }, 400);
  }
  try {
    await dbUpdateOrder(getDb(), id, { status });
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
