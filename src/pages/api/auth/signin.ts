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
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  if (!body.email || !body.password) {
    return json({ error: "Email and password are required" }, 400);
  }
  const auth = createAuthStub(cookies);
  const { data, error } = await auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });
  if (error || !data?.user) {
    return json({ error: error?.message ?? "Invalid credentials" }, 401);
  }
  return json({ user: { id: data.user.id, email: data.user.email } });
};
