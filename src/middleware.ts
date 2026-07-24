import { defineMiddleware } from "astro:middleware";
import { isLocale, DEFAULT_LOCALE } from "./lib/i18n";
import { isCurrency, DEFAULT_CURRENCY } from "./lib/currency";

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, locals, url, redirect } = context;

  // Auth: stub — user is always null until Better Auth is wired.
  locals.user = null;
  locals.isAdmin = false;

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
