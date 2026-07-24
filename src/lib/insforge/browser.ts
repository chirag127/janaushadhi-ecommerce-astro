/**
 * Browser auth client — thin wrapper around @neondatabase/auth BetterAuthReactAdapter.
 * Drop-in replacement for the old InsForge browser stub.
 *
 * Components that call getInsForge().auth.* keep working; the shape matches
 * the Better Auth vanilla client (signIn.email, signUp.email, etc.).
 * OAuth and password-reset are delegated to the hub via /api/auth/* proxy.
 */
import { createAuthClient } from "@neondatabase/auth";
import { BetterAuthReactAdapter, type BetterAuthReactAdapterInstance } from "@neondatabase/auth/react";

function getAuthBaseUrl(): string {
  // During SSR/build this module must not throw even without the var.
  if (typeof window !== "undefined") {
    // In browser, calls go to /api/auth/* on the same origin (catch-all proxy).
    return window.location.origin;
  }
  const fromVite = (import.meta.env as Record<string, string | undefined>)
    .NEON_AUTH_BASE_URL;
  return fromVite ?? "https://auth.oriz.in";
}

type BetterAuthReactClient = ReturnType<
  typeof createAuthClient<BetterAuthReactAdapterInstance>
>;

let _client: BetterAuthReactClient | null = null;

function getClient(): BetterAuthReactClient {
  if (!_client) {
    _client = createAuthClient<BetterAuthReactAdapterInstance>(getAuthBaseUrl(), {
      adapter: BetterAuthReactAdapter(),
    });
  }
  return _client;
}

// ---- InsForge-compatible shim ----
// Existing components call getInsForge().auth.*; we map to Better Auth API.

export interface BrowserAuthStub {
  auth: {
    signInWithOAuth(provider: string, opts?: { redirectTo?: string; additionalParams?: Record<string, string> }): Promise<void>;
    exchangeOAuthCode(code: string): Promise<{ error: { message: string } | null }>;
    resetPassword(opts: { newPassword: string; otp: string }): Promise<{ error: { message: string } | null }>;
    getCurrentUser(): Promise<{ data: { user: { id: string; email?: string | null } | null } }>;
  };
}

export function getInsForge(): BrowserAuthStub {
  return {
    auth: {
      async signInWithOAuth(provider, opts) {
        const client = getClient();
        // Better Auth social sign-in: client.signIn.social({ provider, callbackURL })
        await (client as unknown as {
          signIn: {
            social: (o: { provider: string; callbackURL?: string; fetchOptions?: { headers?: Record<string, string> } }) => Promise<unknown>;
          };
        }).signIn.social({
          provider,
          callbackURL: opts?.redirectTo,
        });
      },
      async exchangeOAuthCode(_code) {
        // Better Auth handles the OAuth callback automatically via the /api/auth/callback/:provider route.
        // Nothing to exchange manually; return ok.
        return { error: null };
      },
      async resetPassword({ newPassword, otp }) {
        const client = getClient();
        const res = await (client as unknown as {
          resetPassword: (o: { newPassword: string; token: string }) => Promise<{ error: { message: string } | null }>;
        }).resetPassword({ newPassword, token: otp });
        return { error: res?.error ?? null };
      },
      async getCurrentUser() {
        const client = getClient();
        const session = await (client as unknown as {
          getSession: () => Promise<{ data: { user?: { id: string; email?: string | null } | null } | null }>;
        }).getSession();
        return { data: { user: session?.data?.user ?? null } };
      },
    },
  };
}
