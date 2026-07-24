import type { APIRoute } from "astro";
import { createAuthStub } from "@lib/insforge/server";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  if (!body.email) return json({ error: "Email is required" }, 400);

  const auth = createAuthStub(cookies);
  const { error } = await auth.sendResetPasswordEmail({
    email: body.email,
    redirectTo: `${new URL(request.url).origin}/reset-password`,
  });
  if (error) console.error("[forgot]", error.message);
  return json({ ok: true });
};
