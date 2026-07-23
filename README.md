# janaushadhi-ecommerce-astro

Jan Aushadhi generic-medicine e-commerce storefront — **Astro (SSR) + InsForge + Razorpay**, deployed on Cloudflare Pages.

Part of the four-framework Jan Aushadhi build (astro / nextjs / laravel / wordpress), all backed by one shared InsForge project.

## Stack

- **Astro 7** SSR (`output: "server"`), `@astrojs/cloudflare` adapter → Cloudflare Pages
- **InsForge** backend (`@insforge/sdk`) — Postgres, auth, storage, RLS, managed Razorpay payments
- **React islands** for interactive pieces (cart, wishlist, admin, checkout)
- **Tailwind v4**, nanostores (cart/wishlist/prefs), en/hi i18n sitemap

## Features

**Storefront:** landing, product catalog (search, category filter, price range, sort, pagination), product detail (reviews, related, JSON-LD), categories, cart, checkout (address + **coupon codes** + Razorpay/COD), order confirmation + history, wishlist, blog, contact/FAQ, dark/light/system theme.

**Account:** dashboard, orders, address book (CRUD, default), wishlist, reviews.

**Admin (`role = admin`):** dashboard (revenue/orders/products/customers), products CRUD + image upload (storage bucket), categories, coupons, orders + status, inventory.

**Platform:** cookie sessions with middleware refresh + route guards (`/account`, `/orders`, `/checkout`, `/admin`), RLS on every table, auto-profile on signup.

## Setup

```bash
pnpm install
cp .env.example .env      # fill InsForge URL + anon key + api key (see below)
pnpm run dev              # http://localhost:4321
pnpm run build            # Cloudflare Pages build
```

Env values:

- `PUBLIC_INSFORGE_URL` / `INSFORGE_URL` = `oss_host` from `.insforge/project.json`
- `PUBLIC_INSFORGE_ANON_KEY` = `npx @insforge/cli secrets get ANON_KEY`
- `INSFORGE_API_KEY` = `api_key` from `.insforge/project.json` (server-only, bypasses RLS — never expose to browser)
- `PUBLIC_RAZORPAY_TEST_MODE` = `"true"` (test) / `"false"` (live)

## Razorpay (managed by InsForge)

Keys live on the InsForge backend, not in env:

```bash
npx @insforge/cli payments razorpay config set --environment test \
  --key-id rzp_test_xxx --key-secret xxx
```

If Razorpay is unconfigured, checkout gracefully falls back to Cash-on-Delivery.

## Backend

Shared InsForge project `janaushadhi-shared`. Schema lives in `db/*.sql` (applied via `migrations/`); catalog seeded from `meds.csv` (2,439 medicines, 60 categories) via `scripts/gen_seed_sql.py`.
