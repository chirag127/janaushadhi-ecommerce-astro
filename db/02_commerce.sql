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
