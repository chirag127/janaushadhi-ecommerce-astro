import type { APIRoute } from "astro";
import { createInsForgeServer } from "@lib/insforge/server";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const b = (await request.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
  };
  if (!b.name || !b.email || !b.message) {
    return json({ error: "Name, email and message are required" }, 400);
  }
  const insforge = createInsForgeServer(cookies, locals);
  const { error } = await insforge.database.from("contact_messages").insert([
    {
      name: b.name,
      email: b.email,
      subject: b.subject ?? null,
      message: b.message,
    },
  ]);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
};
