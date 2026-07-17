import { createAdminClient } from "@insforge/sdk";
import { getEnv } from "./server";

/**
 * Server-only admin client (full access, bypasses RLS).
 * Use ONLY in API routes / server code that has already authorized the caller.
 * Never import into browser/client components.
 */
export function createInsForgeAdmin(locals: App.Locals) {
  return createAdminClient({
    baseUrl: getEnv(locals, "INSFORGE_URL"),
    apiKey: getEnv(locals, "INSFORGE_API_KEY"),
  });
}
