import type { APIRoute } from "astro";
import { getDb } from "@lib/db/client";
import { dbInsertContactMessage } from "@lib/db/repository";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const b = (await request.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
  };
  if (!b.name || !b.email || !b.message) {
    return json({ error: "Name, email and message are required" }, 400);
  }
  try {
    await dbInsertContactMessage(getDb(), {
      name: b.name,
      email: b.email,
      subject: b.subject ?? null,
      message: b.message,
    });
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
