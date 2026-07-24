/**
 * Server utilities: env resolution + auth stub.
 * InsForge SDK removed — auth is a separate lane (oriz-accounts via Better Auth).
 */
import type { AstroCookies } from "astro";

export function getEnv(_locals: App.Locals | undefined, key: string): string {
  const fromImportMeta = (import.meta.env as Record<string, string | undefined>)[key];
  if (fromImportMeta) return fromImportMeta;
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key] as string;
  }
  return "";
}

// ---- Auth stub ----
// Full auth wiring (oriz-accounts / Better Auth) is a separate lane.
// These stubs let the app compile; auth API routes return graceful errors.

export interface AuthUser {
  id: string;
  email?: string | null;
  name?: string | null;
  [key: string]: unknown;
}

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

/** Thin auth stub — replace body when Better Auth is wired. */
export function createAuthStub(_cookies: AstroCookies): AuthStub {
  return {
    async getCurrentUser() {
      return { data: { user: null } };
    },
    async signInWithPassword() {
      return { data: null, error: { message: "Auth not yet configured" } };
    },
    async signUp() {
      return { data: null, error: { message: "Auth not yet configured" } };
    },
    async signOut() {},
    async sendResetPasswordEmail() {
      return { error: null };
    },
  };
}
