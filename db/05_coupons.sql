-- ============================================================
-- Schema Part 5: Coupons (discount system) + RLS
-- Completes the Jan Aushadhi commerce spec (coupon system).
-- Idempotent: safe to re-run.
-- ============================================================

do $$ begin
  create type public.discount_type as enum ('percent', 'fixed');
exception when duplicate_object then null; end $$;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type public.discount_type not null default 'percent',
  discount_value numeric(10,2) not null check (discount_value >= 0),
  min_order_amount numeric(10,2) not null default 0,
  max_discount_amount numeric(10,2),
  usage_limit int,
  used_count int not null default 0,
  per_user_limit int,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists coupons_code_idx on public.coupons(lower(code));
create index if not exists coupons_active_idx on public.coupons(is_active);

-- track coupon redemptions per user/order for per-user limits + audit
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists coupon_redemptions_coupon_idx
  on public.coupon_redemptions(coupon_id);
create index if not exists coupon_redemptions_user_idx
  on public.coupon_redemptions(user_id);

-- link an applied coupon onto orders (nullable)
alter table public.orders
  add column if not exists coupon_id uuid references public.coupons(id) on delete set null;
alter table public.orders
  add column if not exists discount numeric(10,2) not null default 0;

-- ---------- RLS ----------
alter table public.coupons             enable row level security;
alter table public.coupon_redemptions  enable row level security;

-- Anyone may read active coupons (to validate a code); admins see all.
drop policy if exists coupons_read on public.coupons;
create policy coupons_read on public.coupons
  for select to anon, authenticated
  using (is_active = true or public.is_admin());
drop policy if exists coupons_write on public.coupons;
create policy coupons_write on public.coupons
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Redemptions: a user sees their own; admins see all. Insert for self.
drop policy if exists coupon_redemptions_select on public.coupon_redemptions;
create policy coupon_redemptions_select on public.coupon_redemptions
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists coupon_redemptions_insert on public.coupon_redemptions;
create policy coupon_redemptions_insert on public.coupon_redemptions
  for insert to authenticated
  with check (user_id = (select auth.uid()));
