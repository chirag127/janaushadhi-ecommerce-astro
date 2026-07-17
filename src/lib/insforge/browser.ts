import { createBrowserClient } from "@insforge/sdk/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Singleton browser InsForge client. Reads the browser-readable
 * `insforge_access_token` cookie and refreshes via /api/auth/refresh.
 * Auth mutations (sign in/up/out) must go through server routes.
 */
export function getInsForge() {
  if (client) return client;
  client = createBrowserClient({
    baseUrl: import.meta.env.PUBLIC_INSFORGE_URL,
    anonKey: import.meta.env.PUBLIC_INSFORGE_ANON_KEY,
    refreshUrl: "/api/auth/refresh",
  });
  return client;
}
