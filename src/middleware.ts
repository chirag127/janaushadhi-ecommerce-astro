import { defineMiddleware } from "astro:middleware";
import { updateSession } from "@insforge/sdk/ssr/middleware";
import {
  createInsForgeServer,
  astroCookieStore,
  getEnv,
} from "./lib/insforge/server";
import { isLocale, DEFAULT_LOCALE } from "./lib/i18n";
import { isCurrency, DEFAULT_CURRENCY } from "./lib/currency";

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, locals, url, redirect } = context;

  const store = astroCookieStore(cookies);

  // Refresh the InsForge session (writes fresh cookies) before rendering.
  try {
    await updateSession({
      baseUrl: getEnv(locals, "PUBLIC_INSFORGE_URL"),
      anonKey: getEnv(locals, "PUBLIC_INSFORGE_ANON_KEY"),
      requestCookies: store,
      responseCookies: store,
    });
  } catch {
    // ignore refresh failures (guest / expired) — treat as anonymous
  }

  // Resolve current user + admin status.
  locals.user = null;
  locals.isAdmin = false;
  try {
    const insforge = createInsForgeServer(cookies, locals);
    const { data } = await insforge.auth.getCurrentUser();
    const user = (data as { user?: App.Locals["user"] } | null)?.user ?? null;
    if (user) {
      locals.user = user;
      const { data: profile } = await insforge.database
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      locals.isAdmin = (profile as { role?: string } | null)?.role === "admin";
    }
  } catch {
    // anonymous
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
