/**
 * Neon Managed Better Auth client factory.
 * Browser-only: BetterAuthReactAdapter with React hooks.
 * Server: use getAuthBaseUrl() + direct hub fetch (see insforge/server.ts).
 *
 * Hub: oriz-accounts (project autumn-recipe-04450972).
 * NEON_AUTH_BASE_URL points to the hub's Better Auth endpoint.
 */
import { createAuthClient } from "@neondatabase/auth";
import { BetterAuthReactAdapter, type BetterAuthReactAdapterInstance } from "@neondatabase/auth/react";

export { BetterAuthReactAdapter };

export function getAuthBaseUrl(): string {
  // Astro/Vite only expose PUBLIC_-prefixed vars to browser code; the bare
  // NEON_AUTH_BASE_URL is server-only. Read PUBLIC_ first for the client bundle.
  const env = import.meta.env as Record<string, string | undefined>;
  const fromVite = env.PUBLIC_NEON_AUTH_BASE_URL ?? env.NEON_AUTH_BASE_URL;
  if (fromVite) return fromVite;
  if (typeof process !== "undefined" && process.env?.NEON_AUTH_BASE_URL) {
    return process.env.NEON_AUTH_BASE_URL;
  }
  return "https://auth.oriz.in";
}

type ReactClient = ReturnType<typeof createAuthClient<BetterAuthReactAdapterInstance>>;
let _reactClient: ReactClient | null = null;

/** Browser-side Better Auth React client (singleton). */
export function getAuthClient(): ReactClient {
  if (!_reactClient) {
    _reactClient = createAuthClient<BetterAuthReactAdapterInstance>(getAuthBaseUrl(), {
      adapter: BetterAuthReactAdapter(),
    });
  }
  return _reactClient;
}
