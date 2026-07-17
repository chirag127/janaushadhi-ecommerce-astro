import type { APIRoute } from "astro";
import { createInsForgeAuthActions } from "@lib/insforge/server";

export const prerender = false;

export const POST: APIRoute = async ({ cookies, locals, redirect }) => {
  const auth = createInsForgeAuthActions(cookies, locals);
  try {
    await auth.signOut();
  } catch {
    /* ignore */
  }
  return redirect("/");
};
