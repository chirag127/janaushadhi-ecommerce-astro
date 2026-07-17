-- ============================================================
-- Jan Aushadhi Ecommerce - Canonical schema (combined parts 1-5)
-- Applied ONCE to the shared InsForge project 'janaushadhi-shared'.
-- Idempotent: safe to re-run.
-- ============================================================

-- >>>>>>>>>> db\01_tables.sql >>>>>>>>>>
-- ============================================================
-- Jan Aushadhi Ecommerce - Schema Part 1: Extensions + Enums + Core Tables
-- InsForge (Postgres). Apply via: npx @insforge/cli db query "$(cat db/01_tables.sql)"
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------- ENUMS ----------
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

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role public.user_role not null default 'customer',
  preferred_locale text default 'en',
  preferred_currency text default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- ADDRESSES ----------
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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

-- ---------- CATEGORIES ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- PRODUCTS ----------
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
create index if not exists products_active_idx on public.products(is_active);
create index if not exists products_search_idx on public.products using gin(search_vector);
create index if not exists products_name_trgm_idx
  on public.products using gin (name gin_trgm_ops);


-- >>>>>>>>>> db\02_commerce.sql >>>>>>>>>>
-- ============================================================
-- Schema Part 2: Commerce tables (cart, wishlist, orders, reviews, content)
-- ============================================================

-- ---------- CART ITEMS ----------
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

-- ---------- WISHLIST ----------
create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

-- ---------- ORDERS ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'created',
  subtotal numeric(10,2) not null default 0,
  shipping numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  currency text not null default 'INR',
  shipping_address jsonb,
  razorpay_order_id text,
  razorpay_payment_id text,
  is_test_payment boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_rzp_idx on public.orders(razorpay_order_id);

-- ---------- ORDER ITEMS ----------
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

-- ---------- REVIEWS ----------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  title text,
  comment text,
  created_at timestamptz not null default now(),
  unique(product_id, user_id)
);
create index if not exists reviews_product_idx on public.reviews(product_id);

-- ---------- BLOG POSTS ----------
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

-- ---------- CONTACT MESSAGES ----------
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  created_at timestamptz not null default now()
);


-- >>>>>>>>>> db\03_functions.sql >>>>>>>>>>
-- ============================================================
-- Schema Part 3: Functions & Triggers
-- ============================================================

-- product search_vector + updated_at maintenance
create or replace function public.products_search_trigger()
returns trigger
language plpgsql
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

-- orders.updated_at maintenance (InsForge ships system.update_updated_at())
drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at
  before update on public.orders
  for each row execute function system.update_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function system.update_updated_at();

-- auto-create a profile row when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- helper: is current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public, pg_temp
as $$
  select exists(
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;


-- >>>>>>>>>> db\04_rls.sql >>>>>>>>>>
-- ============================================================
-- Schema Part 4: RLS Policies (InsForge)
-- InsForge grants broad DML to anon/authenticated by default; RLS decides rows.
-- ============================================================

alter table public.profiles         enable row level security;
alter table public.addresses        enable row level security;
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.cart_items       enable row level security;
alter table public.wishlist_items   enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.reviews          enable row level security;
alter table public.blog_posts       enable row level security;
alter table public.contact_messages enable row level security;

-- ---------- PROFILES ----------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
-- users may not change their own role
revoke update (role) on public.profiles from authenticated;

-- ---------- ADDRESSES ----------
drop policy if exists addresses_all on public.addresses;
create policy addresses_all on public.addresses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------- CATEGORIES ----------
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories
  for select to anon, authenticated using (true);
drop policy if exists categories_write on public.categories;
create policy categories_write on public.categories
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- PRODUCTS ----------
drop policy if exists products_read on public.products;
create policy products_read on public.products
  for select to anon, authenticated
  using (is_active = true or public.is_admin());
drop policy if exists products_write on public.products;
create policy products_write on public.products
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- CART ----------
drop policy if exists cart_all on public.cart_items;
create policy cart_all on public.cart_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------- WISHLIST ----------
drop policy if exists wishlist_all on public.wishlist_items;
create policy wishlist_all on public.wishlist_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------- ORDERS ----------
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update on public.orders
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- ORDER ITEMS ----------
drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select to authenticated
  using (exists(select 1 from public.orders o
    where o.id = order_id and (o.user_id = (select auth.uid()) or public.is_admin())));
drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items
  for insert to authenticated
  with check (exists(select 1 from public.orders o
    where o.id = order_id and o.user_id = (select auth.uid())));

-- ---------- REVIEWS ----------
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews
  for select to anon, authenticated using (true);
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists reviews_update on public.reviews;
create policy reviews_update on public.reviews
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists reviews_delete on public.reviews;
create policy reviews_delete on public.reviews
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- ---------- BLOG ----------
drop policy if exists blog_read on public.blog_posts;
create policy blog_read on public.blog_posts
  for select to anon, authenticated
  using (is_published = true or public.is_admin());
drop policy if exists blog_write on public.blog_posts;
create policy blog_write on public.blog_posts
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- CONTACT ----------
drop policy if exists contact_insert on public.contact_messages;
create policy contact_insert on public.contact_messages
  for insert to anon, authenticated with check (true);
drop policy if exists contact_read on public.contact_messages;
create policy contact_read on public.contact_messages
  for select to authenticated using (public.is_admin());


-- >>>>>>>>>> db\05_coupons.sql >>>>>>>>>>
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



