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
