import type { APIRoute } from "astro";

export const prerender = false;

// Token refresh stub — replace with Better Auth session refresh when wired.
export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
