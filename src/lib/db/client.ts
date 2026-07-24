import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

function getDatabaseUrl(): string {
  // import.meta.env for Vite/Astro dev + build-inlined vars
  const fromVite = (import.meta.env as Record<string, string | undefined>).DATABASE_URL;
  if (fromVite) return fromVite;
  // Cloudflare Workers process.env (platformProxy + production binding)
  if (typeof process !== "undefined" && process.env?.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  throw new Error("DATABASE_URL is not set");
}

/**
 * Per-request Drizzle client over the Neon HTTP driver.
 * Neon's http driver is safe in Cloudflare Workers (no TCP needed).
 */
export function getDb() {
  const sql = neon(getDatabaseUrl());
  return drizzle(sql);
}
