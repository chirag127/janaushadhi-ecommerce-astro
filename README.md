# janaushadhi-astro

[![GitHub stars](https://img.shields.io/github/stars/chirag127/janaushadhi-ecommerce-astro?style=flat)](https://github.com/chirag127/janaushadhi-ecommerce-astro/stargazers)

Jan Aushadhi generic-medicine e-commerce storefront built with Astro SSR on Cloudflare Workers.

**Live:** https://janaushadhi-astro.oriz.in

One of four framework variants (astro / nextjs / laravel / wordpress) sharing one Neon Postgres project.

## Features

**Storefront:** landing, product catalog (search, category filter, price range, sort, pagination), product detail (reviews, related, JSON-LD), categories, cart, checkout (address + coupon codes + Razorpay / COD), order confirmation + history, wishlist, blog, contact, FAQ, dark/light/system theme.

**Account:** dashboard, orders, address book (CRUD, default address), wishlist, reviews.

**Admin (`role = admin`):** dashboard (revenue / orders / products / customers), products CRUD + image upload, categories, coupons, orders + status update, inventory.

**Platform:** cookie sessions with middleware refresh + route guards (`/account`, `/orders`, `/checkout`, `/admin`), Neon Managed Better Auth (SSO), en/hi i18n sitemap.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Astro 7 SSR (`output: "server"`) |
| Adapter | `@astrojs/cloudflare` → Cloudflare Workers |
| Database | Neon Postgres + Drizzle ORM |
| Auth | Neon Managed Better Auth (`@neondatabase/auth`) |
| Payments | Razorpay (test mode), direct key integration |
| UI | React 19 islands, Tailwind CSS v4, nanostores |
| Runtime | Node 22, pnpm 9 |

## Local Development

```bash
pnpm install
cp .env.example .env   # fill in values — see Environment Variables below
pnpm dev               # http://localhost:4321
pnpm build             # production build (Cloudflare Workers output)
pnpm preview           # preview the built worker locally
```

## Deployment

GitHub Actions deploys on every push to `main` (`.github/workflows/deploy.yml`):

1. Install deps (`pnpm install`)
2. Write build-time env to `.env` (Vite inlines `PUBLIC_*` vars at build)
3. `pnpm build` → Astro + `@astrojs/cloudflare` produces a Worker bundle
4. `wrangler deploy` pushes the bundle to Cloudflare Workers
5. Runtime secrets are pushed to the Worker via `wrangler secret put`

Required GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.

## Environment Variables

Copy `.env.example` to `.env` and fill in real values.

| Variable | Description |
|---|---|
| `SITE_URL` | Public base URL of the site (e.g. `https://janaushadhi-astro.oriz.in`) |
| `PUBLIC_APP_URL` | Same as `SITE_URL`; exposed to client-side code |
| `DATABASE_URL` | Neon Postgres connection string (run `neon env pull` to regenerate) |
| `PUBLIC_RAZORPAY_KEY_ID` | Razorpay Key ID — public, safe for browser |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret — server-only, never expose to browser |
| `PUBLIC_RAZORPAY_TEST_MODE` | `"true"` = test environment; `"false"` = live |
| `NEON_AUTH_BASE_URL` | Server-side Better Auth base URL (Neon Console → Auth → Auth URL) |
| `PUBLIC_NEON_AUTH_BASE_URL` | Same URL, `PUBLIC_`-prefixed so Vite exposes it to client components |
| `NEON_AUTH_COOKIE_SECRET` | Random 32-char secret for signing session cookies |

## License

MIT
