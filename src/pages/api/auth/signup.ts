import type { APIRoute } from "astro";
import { createInsForgeAuthActions } from "@lib/insforge/server";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    fullName?: string;
  };
  if (!body.email || !body.password) {
    return json({ error: "Email and password are required" }, 400);
  }
  if (body.password.length < 6) {
    return json({ error: "Password must be at least 6 characters" }, 400);
  }

  const auth = createInsForgeAuthActions(cookies, locals);
  const { data, error } = await auth.signUp({
    email: body.email,
    password: body.password,
    name: body.fullName,
  });

  if (error) {
    return json({ error: error.message ?? "Sign up failed" }, 400);
  }
  return json({
    user: data?.user ? { id: data.user.id, email: data.user.email } : null,
    requiresVerification: !data?.user,
  });
};
