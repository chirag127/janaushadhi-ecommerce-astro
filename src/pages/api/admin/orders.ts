import type { APIRoute } from "astro";
import { createInsForgeServer } from "@lib/insforge/server";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const PUT: APIRoute = async ({ request, cookies, locals }) => {
  if (!locals.user || !locals.isAdmin) return json({ error: "Forbidden" }, 403);
  const { id, status } = (await request.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
  };
  const valid = [
    "pending",
    "paid",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
  ];
  if (!id || !status || !valid.includes(status)) {
    return json({ error: "Valid id and status required" }, 400);
  }
  const insforge = createInsForgeServer(cookies, locals);
  const { error } = await insforge.database
    .from("orders")
    .update({ status })
    .eq("id", id);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
};
