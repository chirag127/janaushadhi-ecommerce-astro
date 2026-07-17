import type { APIRoute } from "astro";
import { getEnv } from "@lib/insforge/server";
import { createClient } from "@insforge/sdk";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  if (!body.email) {
    return json({ error: "Email is required" }, 400);
  }

  const insforge = createClient({
    baseUrl: getEnv(locals, "PUBLIC_INSFORGE_URL"),
    anonKey: getEnv(locals, "PUBLIC_INSFORGE_ANON_KEY"),
  });

  const { error } = await insforge.auth.sendResetPasswordEmail({
    email: body.email,
    redirectTo: `${new URL(request.url).origin}/reset-password`,
  });

  // Always return success to avoid email enumeration
  if (error) {
    console.error("[forgot] sendResetPasswordEmail error:", error.message);
  }
  return json({ ok: true });
};
