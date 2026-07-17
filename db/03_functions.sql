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
