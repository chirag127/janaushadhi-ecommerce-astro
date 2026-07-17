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
