# Jan Aushadhi (Astro) — InsForge -> Neon migration plan

Status: **groundwork done.** Neon DB linked + schema applied. Live InsForge app
untouched. This file = what's ported, what remains for full cutover, and risks.

Neon project: `noisy-meadow-78549203` (org `org-old-mode-74272352`), branch
`main` (`br-sparkling-shadow-ayoqxtx1`), host `ep-wild-pond-ay6efcli` (us-east-2).

## Done (this pass)

- `neon link` + `neon env pull` -> `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
  `NEON_BRANCH` written to `.env` (gitignored; `.neon/` also ignored).
- `neon-migration/schema.sql` — plain-Postgres port of InsForge `db/01..05.sql`.
- Applied to Neon over the serverless WebSocket driver (port 443; direct
  5432/TCP is blocked on this network — CLI + HTTPS driver both work, raw `psql`
  times out). Verified present: **14 tables** (users, profiles, addresses,
  categories, products, cart_items, wishlist_items, coupons, orders,
  order_items, coupon_redemptions, reviews, blog_posts, contact_messages),
  **4 enums** (order_status, payment_status, user_role, discount_type),
  **triggers** (set_updated_at on users/profiles/orders, products_search_update),
  **extensions** pgcrypto + pg_trgm.

## Schema port decisions (InsForge -> Neon)

| InsForge assumption | Neon reality | What schema.sql does |
|---|---|---|
| `auth.users` table injected by platform | no `auth` schema | added local `public.users`; every FK repointed to it |
| `auth.uid()` RLS helper + per-request JWT role | single DB role | RLS **not recreated** — ownership/admin enforced in app server code |
| `system.update_updated_at()` | absent | local `public.set_updated_at()` |
| `public.is_admin()` (reads JWT) | n/a | dropped; admin check = `profiles.role` read in middleware |
| `handle_new_user()` trigger on `auth.users` insert | no auth trigger point | dropped; app creates the `profiles` row on Better Auth signup |

## Remaining to fully cut over (NOT done — needs app-code changes + redeploy)

1. **DB client swap.** Replace `@insforge/sdk` `.database.from(...)` query builder
   (~40 files under `src/`, incl. `lib/queries.ts`, all `pages/api/*`,
   admin React components) with `@neondatabase/serverless` (HTTP/WebSocket, CF
   Workers-friendly) + a query layer. The InsForge builder is PostgREST-style
   (`.select/.eq/.ilike/.order/.maybeSingle/.in`, embedded
   `category:categories(...)`); rewrite as SQL or a thin helper. Biggest single
   chunk of work; `lib/queries.ts` is the natural seam (already takes a `db`
   arg) — introduce a Neon-backed `db` and keep call sites stable where possible.
2. **Auth rebuild on Better Auth (Neon).** Replace `@insforge/sdk/ssr`
   (`createServerClient/createBrowserClient/createAuthActions`, `updateSession`,
   `auth.getCurrentUser/signInWithOAuth/exchangeOAuthCode/
   sendResetPasswordEmail/resetPassword`). Touch points: `src/middleware.ts`
   (session refresh + `locals.user`/`locals.isAdmin`), `pages/api/auth/*`
   (signin/signup/signout/refresh/forgot), `components/react/AuthForm.tsx`,
   `OAuthCallback.tsx`, `ResetPasswordForm.tsx`, `ForgotPasswordForm.tsx`,
   `ProfileForm.tsx`. Better Auth creates its own session/account/verification
   tables via its adapter — run its migration against Neon; our `public.users`
   is the user target (align columns with Better Auth's expected shape or point
   its adapter at it).
3. **Razorpay hand-wire (gap-mitigation).** InsForge supplied
   `insforge.payments.razorpay.createOrder/verifyOrder` (server-side key custody
   + signature check). Neon has no payments layer. Implement directly:
   - `pages/api/orders/create.ts`: call Razorpay Orders API with
     `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` (server env), store `razorpay_order_id`.
   - `pages/api/orders/verify.ts`: verify signature via HMAC-SHA256 over
     `order_id|payment_id` with the key secret (crypto in the Worker), then
     `fulfillOrder`. Keep test/live split (`PUBLIC_RAZORPAY_TEST_MODE`).
   - Never expose the key secret to the browser.
4. **Admin client replacement.** `lib/insforge/admin.ts` (RLS-bypass) becomes a
   privileged Neon connection used only in already-authorized server routes
   (`pages/api/admin/*`, analytics/inventory/customers admin pages). Since RLS is
   gone, EVERY route must enforce ownership/admin itself — audit each
   `pages/api/*` for the `locals.user`/`locals.isAdmin` guard.
5. **Re-seed catalog.** Load products/categories into Neon. Source of truth is
   `meds.csv` + `scripts/gen_seed_sql.py` (or reuse `db-seed/seed_data.sql` /
   `migrations/20260717090000_seed-data.sql`, regenerated for the `public.users`
   FK model — the seed must NOT reference auth.users). Run over the same HTTP
   driver used here. `products_search_update` fills `search_vector` on insert.
6. **Env + config.** Drop `PUBLIC_INSFORGE_URL/ANON_KEY`, `INSFORGE_URL/API_KEY`;
   add `DATABASE_URL` (+ Better Auth secret, Razorpay keys) to `.env`,
   `.env.example`, and Cloudflare Pages/Workers secrets (`wrangler`). Remove
   `@insforge/sdk` from `package.json`; add `@neondatabase/serverless` +
   `better-auth`.
7. **Delete InsForge code** (LAST, only after 1-6 verified): `src/lib/insforge/*`,
   `.insforge/`, InsForge-specific SQL under `db/` + `migrations/`. Update
   `README.md`/`AGENTS.md` ("InsForge backend" -> Neon).
8. **Redeploy** to Cloudflare Pages; smoke-test browse/search/cart/auth/checkout.

## Risks

- **Auth is the hard part.** InsForge bundled JWT issuance, OAuth, email reset,
  and RLS. Better Auth covers auth but RLS enforcement moves entirely into app
  code — a missed guard on any `pages/api/*` route = data exposure. Audit all
  routes; add tests.
- **Query-builder rewrite surface is large** (~40 files) and easy to regress
  (embedded joins, `count: exact` pagination, `maybeSingle`). Do it behind
  `lib/queries.ts` and test each query.
- **Network:** direct Postgres TCP (5432) is blocked here; app must use Neon's
  HTTP/WebSocket serverless driver (also the right choice for CF Workers). Local
  `psql` won't reach the DB on this network.
- **Razorpay signature/security:** hand-rolled HMAC verify must exactly match
  Razorpay's scheme; keep secret server-only; keep test/live separation.
- **Seed FK model changed:** old seed targets `auth.users`; regenerate so it
  only references `public.users`, or seed users first.
- **Better Auth user-table shape** may not match our `public.users` columns;
  reconcile (let Better Auth own its tables and FK `profiles`/domain tables to
  its user id, OR map its adapter onto `public.users`).
- **No RLS safety net** during the transition — until app guards are complete,
  the Neon DB has no row-level protection. Keep it non-public until cutover.

## Reproduce the apply

```
cd repos/own/janaushadhi-astro
# DATABASE_URL already in .env (neon env pull)
# HTTP/WebSocket driver (5432 is blocked); example:
node -e "const{Pool,neonConfig}=require('@neondatabase/serverless');const ws=require('ws');neonConfig.webSocketConstructor=ws;const fs=require('fs');(async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});await p.query(fs.readFileSync('neon-migration/schema.sql','utf8'));await p.end();})()"
```
