import type { APIRoute } from "astro";
import { createAuthStub } from "@lib/insforge/server";

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect }) => {
  await createAuthStub(cookies).signOut().catch(() => {});
  return redirect("/");
};
