/**
 * Catch-all route that proxies all /api/auth/* requests to the
 * oriz-accounts Neon Managed Better Auth hub.
 *
 * Better Auth expects to own the full /api/auth path (GET + POST).
 * The hub handles: sign-in, sign-up, sign-out, session, OAuth callbacks,
 * forgot-password, reset-password, token refresh.
 *
 * Cookie domain is set to .oriz.in by the hub; this proxy is transparent.
 */
import type { APIRoute } from "astro";

export const prerender = false;

function getAuthBaseUrl(): string {
  const fromVite = (import.meta.env as Record<string, string | undefined>)
    .NEON_AUTH_BASE_URL;
  if (fromVite) return fromVite;
  if (typeof process !== "undefined" && process.env?.NEON_AUTH_BASE_URL) {
    return process.env.NEON_AUTH_BASE_URL;
  }
  return "https://auth.oriz.in";
}

async function proxyToHub(request: Request, params: Record<string, string | undefined>): Promise<Response> {
  const base = getAuthBaseUrl().replace(/\/$/, "");
  const slug = (params.all ?? "").replace(/^\//, "");
  const original = new URL(request.url);
  const target = new URL(`${base}/api/auth/${slug}${original.search}`);

  // Forward headers, strip host (hub resolves its own host).
  const headers = new Headers(request.headers);
  headers.delete("host");

  return fetch(target.toString(), {
    method: request.method,
    headers,
    body: request.method !== "GET" && request.method !== "HEAD"
      ? request.body
      : undefined,
    // @ts-expect-error CF Workers / undici support duplex
    duplex: "half",
  });
}

export const GET: APIRoute = async ({ request, params }) => proxyToHub(request, params);
export const POST: APIRoute = async ({ request, params }) => proxyToHub(request, params);
