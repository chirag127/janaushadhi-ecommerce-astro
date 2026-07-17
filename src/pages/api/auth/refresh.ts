import type { APIRoute } from "astro";
import { refreshAuth } from "@insforge/sdk/ssr";
import { getEnv, astroCookieStore } from "@lib/insforge/server";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const result = await refreshAuth({
    baseUrl: getEnv(locals, "PUBLIC_INSFORGE_URL"),
    anonKey: getEnv(locals, "PUBLIC_INSFORGE_ANON_KEY"),
    request,
    cookies: astroCookieStore(cookies),
  });
  return result.response;
};
