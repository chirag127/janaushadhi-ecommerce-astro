import type { APIRoute } from "astro";
import { getDb } from "@lib/db/client";
import { dbUpdateProfile } from "@lib/db/repository";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Not authenticated" }, 401);
  const { full_name, phone } = (await request.json().catch(() => ({}))) as {
    full_name?: string;
    phone?: string;
  };
  try {
    await dbUpdateProfile(getDb(), locals.user.id, {
      full_name: full_name ?? null,
      phone: phone ?? null,
    });
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
