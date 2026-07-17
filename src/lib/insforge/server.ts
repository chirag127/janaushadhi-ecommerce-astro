import type { AstroCookies } from "astro";
import {
  createServerClient,
  createAuthActions,
  type CookieStore,
} from "@insforge/sdk/ssr";

/**
 * Reads an env var across runtimes:
 *  - Local dev / SSR build: `import.meta.env` (populated from `.env`; Vite also
 *    inlines PUBLIC_* at build time so they're present in the prod bundle too).
 *  - Cloudflare Workers (Astro v6+): the `cloudflare:workers` `env` binding for
 *    server-only secrets. `Astro.locals.runtime.env` was REMOVED in Astro v6.
 *
 * The `locals` arg is kept for call-site compatibility but is no longer read.
 */
export function getEnv(_locals: App.Locals | undefined, key: string): string {
  // 1. import.meta.env — dev vars + build-inlined PUBLIC_* in production.
  // @ts-expect-error dynamic access on import.meta.env
  const fromImportMeta = import.meta.env[key] as string | undefined;
  if (fromImportMeta) return fromImportMeta;

  // 2. Cloudflare Workers env binding (server-only secrets in production).
  const cf = cfEnv();
  if (cf && cf[key]) return cf[key] as string;

  // 3. Node-style process.env (platformProxy / other adapters).
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return "";
}

/**
 * Lazily resolves the Cloudflare `env` binding. Cached across calls. Returns
 * undefined outside the Workers runtime (e.g. Node dev), where step 1 covers us.
 */
let _cfEnv: Record<string, unknown> | null | undefined;
function cfEnv(): Record<string, unknown> | undefined {
  if (_cfEnv !== undefined) return _cfEnv ?? undefined;
  try {
    // Synchronous access via globalThis proxy that the Workers runtime exposes.
    // We can't statically `import "cloudflare:workers"` here because Vite's dev
    // server can't resolve that virtual module; the adapter injects it in prod.
    const g = globalThis as { process?: { env?: Record<string, unknown> } };
    _cfEnv = g.process?.env ?? null;
  } catch {
    _cfEnv = null;
  }
  return _cfEnv ?? undefined;
}

/**
 * Adapts Astro's cookie API to the InsForge SDK CookieStore interface
 * (get / set / delete).
 */
export function astroCookieStore(cookies: AstroCookies): CookieStore {
  return {
    get(name: string) {
      const c = cookies.get(name);
      return c ? { value: c.value } : undefined;
    },
    set(nameOrOpts: unknown, value?: string, options?: Record<string, unknown>) {
      if (typeof nameOrOpts === "string") {
        cookies.set(nameOrOpts, value ?? "", {
          path: "/",
          ...(options as object),
        });
      } else {
        const o = nameOrOpts as { name: string; value: string };
        const { name, value: v, ...rest } = o;
        cookies.set(name, v, { path: "/", ...rest });
      }
    },
    delete(nameOrOpts: unknown) {
      const name =
        typeof nameOrOpts === "string"
          ? nameOrOpts
          : (nameOrOpts as { name: string }).name;
      cookies.delete(name, { path: "/" });
    },
  };
}

/**
 * Per-request InsForge server client bound to Astro cookies.
 * Uses the anon key + user's access-token cookie so RLS applies.
 */
export function createInsForgeServer(cookies: AstroCookies, locals: App.Locals) {
  return createServerClient({
    baseUrl: getEnv(locals, "PUBLIC_INSFORGE_URL"),
    anonKey: getEnv(locals, "PUBLIC_INSFORGE_ANON_KEY"),
    cookies: astroCookieStore(cookies),
  });
}

/**
 * Auth actions (sign-in/up/out, OAuth) that write session cookies.
 */
export function createInsForgeAuthActions(
  cookies: AstroCookies,
  locals: App.Locals,
) {
  return createAuthActions({
    baseUrl: getEnv(locals, "PUBLIC_INSFORGE_URL"),
    anonKey: getEnv(locals, "PUBLIC_INSFORGE_ANON_KEY"),
    cookies: astroCookieStore(cookies),
  });
}
