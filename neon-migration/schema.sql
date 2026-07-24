-- ============================================================
-- Jan Aushadhi Ecommerce — Neon (plain Postgres) schema
-- Ported from InsForge db/01..05.sql. Apply with:
--   psql "$DATABASE_URL" -f neon-migration/schema.sql
-- Idempotent: safe to re-run. See PLAN.md for porting notes.
-- InsForge auth.users -> local public.users; system.update_updated_at ->
-- public.set_updated_at; RLS (auth.uid based) moved to app layer, not recreated.
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

do $$ begin
  create type public.order_status as enum
    ('pending','paid','processing','shipped','delivered','cancelled','refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum
    ('created','pending','captured','failed','refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_role as enum ('customer','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.discount_type as enum ('percent','fixed');
exception when duplicate_object then null; end $$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  email_verified boolean not null default false,
  name text,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references public.users(id) on delete cascade,
  full_name text,
  phone text,
  role public.user_role not null default 'customer',
  preferred_locale text default 'en',
  preferred_currency text default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  pincode text not null,
  country text not null default 'India',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  drug_code text unique,
  name text not null,
  slug text not null unique,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  unit_size text,
  mrp numeric(10,2) not null default 0,
  price numeric(10,2) not null default 0,
  stock int not null default 0,
  image_url text,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_active_idx   on public.products(is_active);
create index if not exists products_search_idx   on public.products using gin(search_vector);
create index if not exists products_name_trgm_idx on public.products using gin (name gin_trgm_ops);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

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
create index if not exists coupons_code_idx   on public.coupons(lower(code));
create index if not exists coupons_active_idx on public.coupons(is_active);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references public.users(id) on delete set null,
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'created',
  subtotal numeric(10,2) not null default 0,
  shipping numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  currency text not null default 'INR',
  shipping_address jsonb,
  coupon_id uuid references public.coupons(id) on delete set null,
  razorpay_order_id text,
  razorpay_payment_id text,
  is_test_payment boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_idx   on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_rzp_idx    on public.orders(razorpay_order_id);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null,
  quantity int not null,
  line_total numeric(10,2) not null
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists coupon_redemptions_coupon_idx on public.coupon_redemptions(coupon_id);
create index if not exists coupon_redemptions_user_idx   on public.coupon_redemptions(user_id);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  title text,
  comment text,
  created_at timestamptz not null default now(),
  unique(product_id, user_id)
);
create index if not exists reviews_product_idx on public.reviews(product_id);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text,
  cover_image_url text,
  author text default 'Jan Aushadhi Team',
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create or replace function public.products_search_trigger()
returns trigger language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.description,'')), 'B');
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists products_search_update on public.products;
create trigger products_search_update
  before insert or update on public.products
  for each row execute function public.products_search_trigger();

-- ============================================================
-- RLS: intentionally omitted on Neon. InsForge policies relied on auth.uid()
-- and a request-scoped JWT role. On Neon the app connects as one DB role and
-- enforces ownership/admin in server code (Better Auth session). See PLAN.md.
-- ============================================================
