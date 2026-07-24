import { defineMiddleware } from "astro:middleware";
import { isLocale, DEFAULT_LOCALE } from "./lib/i18n";
import { isCurrency, DEFAULT_CURRENCY } from "./lib/currency";
import { getCurrentUser } from "./lib/insforge/server";
import { getDb } from "./lib/db/client";
import { users } from "./lib/db/schema";
import { eq } from "drizzle-orm";

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, locals, url, redirect, request } = context;

  // ---- Auth: resolve session from oriz-accounts hub ----
  const cookieHeader = request.headers.get("cookie");
  const hubUser = await getCurrentUser(cookieHeader).catch(() => null);

  if (hubUser?.id) {
    // Upsert local user row (keyed by Better Auth subject id).
    try {
      const db = getDb();
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, hubUser.id))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(users).values({
          id: hubUser.id,
          email: hubUser.email ?? `${hubUser.id}@neon.oriz.in`,
          email_verified: hubUser.emailVerified ?? false,
          name: hubUser.name ?? null,
          image: hubUser.image ?? null,
        }).onConflictDoNothing();
      } else if (hubUser.email || hubUser.name) {
        // Sync mutable fields.
        await db
          .update(users)
          .set({
            email: hubUser.email ?? undefined,
            name: hubUser.name ?? null,
            image: hubUser.image ?? null,
            updated_at: new Date(),
          })
          .where(eq(users.id, hubUser.id));
      }
    } catch {
      // Non-fatal: DB may be unavailable during cold start or CI build.
    }
    locals.user = {
      id: hubUser.id,
      email: hubUser.email ?? null,
      name: hubUser.name ?? null,
    };
    locals.isAdmin = false; // Admin flag from local profiles table (resolved lazily per-page).
  } else {
    locals.user = null;
    locals.isAdmin = false;
  }

  // Locale + currency from cookies (with defaults).
  const loc = cookies.get("ja_locale")?.value;
  locals.locale = isLocale(loc) ? loc : DEFAULT_LOCALE;
  const cur = cookies.get("ja_currency")?.value;
  locals.currency = isCurrency(cur) ? cur : DEFAULT_CURRENCY;

  // Route guards.
  const path = url.pathname;
  if (path.startsWith("/admin")) {
    if (!locals.user) return redirect(`/login?next=${encodeURIComponent(path)}`);
    if (!locals.isAdmin) return redirect("/");
  }
  const protectedPaths = ["/account", "/orders", "/checkout", "/wishlist"];
  if (protectedPaths.some((p) => path === p || path.startsWith(p + "/"))) {
    if (!locals.user) return redirect(`/login?next=${encodeURIComponent(path)}`);
  }

  return next();
});
