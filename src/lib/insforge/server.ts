/**
 * Server-side auth helpers.
 * Resolves the current user from the Better Auth session cookie sent by
 * the oriz-accounts hub (NEON_AUTH_BASE_URL).
 *
 * Session check: GET /api/auth/get-session forwarded to hub via the
 * [...all] proxy, or directly from hub using the incoming cookie header.
 */
import type { AstroCookies } from "astro";

export interface AuthUser {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean;
  [key: string]: unknown;
}

function getAuthBaseUrl(): string {
  const fromVite = (import.meta.env as Record<string, string | undefined>)
    .NEON_AUTH_BASE_URL;
  if (fromVite) return fromVite;
  if (typeof process !== "undefined" && process.env?.NEON_AUTH_BASE_URL) {
    return process.env.NEON_AUTH_BASE_URL;
  }
  return "";
}

/**
 * Resolve the current authenticated user from the hub session.
 * Returns null when the user is not signed in or the hub is unreachable.
 */
export async function getCurrentUser(
  cookieHeader: string | null,
): Promise<AuthUser | null> {
  const base = getAuthBaseUrl();
  if (!base) return null; // hub not configured yet
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/auth/get-session`, {
      method: "GET",
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { user?: AuthUser | null } | null;
    return body?.user ?? null;
  } catch {
    return null;
  }
}

export function getEnv(_locals: App.Locals | undefined, key: string): string {
  const fromImportMeta = (import.meta.env as Record<string, string | undefined>)[key];
  if (fromImportMeta) return fromImportMeta;
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key] as string;
  }
  return "";
}

// ---- Legacy stub types (kept for API-route backward compat during transition) ----
export interface AuthStub {
  getCurrentUser(): Promise<{ data: { user: AuthUser | null } }>;
  signInWithPassword(
    opts: { email: string; password: string },
  ): Promise<{ data: { user: AuthUser | null } | null; error: { message: string } | null }>;
  signUp(
    opts: { email: string; password: string; name?: string },
  ): Promise<{ data: { user: AuthUser | null } | null; error: { message: string } | null }>;
  signOut(): Promise<void>;
  sendResetPasswordEmail(
    opts: { email: string; redirectTo: string },
  ): Promise<{ error: { message: string } | null }>;
}

/** @deprecated Use getCurrentUser() + the [...all] proxy route instead. */
export function createAuthStub(_cookies: AstroCookies): AuthStub {
  return {
    async getCurrentUser() { return { data: { user: null } }; },
    async signInWithPassword() { return { data: null, error: { message: "Use /api/auth/* proxy" } }; },
    async signUp() { return { data: null, error: { message: "Use /api/auth/* proxy" } }; },
    async signOut() {},
    async sendResetPasswordEmail() { return { error: null }; },
  };
}
