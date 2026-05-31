
-- =========================
-- Enums
-- =========================
create type public.app_role as enum ('customer', 'seller', 'admin');
create type public.seller_status as enum ('pending', 'approved', 'suspended');
create type public.order_status as enum ('pending', 'paid', 'fulfilled', 'cancelled');
create type public.visit_source as enum ('direct', 'whatsapp', 'search');

create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, full_name text, whatsapp_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.profiles to anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);
create trigger update_profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();

-- user_roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create policy "Users can view their own roles" on public.user_roles for select using (auth.uid() = user_id);
create policy "Admins can view all roles" on public.user_roles for select using (public.has_role(auth.uid(), 'admin'));
create policy "Admins can manage roles" on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- New user trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare is_first_user boolean;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  select not exists (select 1 from public.user_roles) into is_first_user;
  if is_first_user then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'customer');
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- themes
create table public.themes (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique,
  preview_image_url text, css_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.themes to anon, authenticated;
grant all on public.themes to service_role;
alter table public.themes enable row level security;
create policy "Themes are viewable by everyone" on public.themes for select using (true);
create policy "Admins manage themes" on public.themes for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

insert into public.themes (name, slug, css_config) values
('Aegean Blue', 'aegean-blue', '{"bg":"#f4f8fb","surface":"#ffffff","text":"#0b2545","primary":"#13315c","accent":"#1e6091","muted":"#8da9c4","border":"#dbe7f0","card":"#ffffff","fontHead":"Playfair Display","fontBody":"Inter","radius":"0.5rem"}'),
('Santorini White', 'santorini-white', '{"bg":"#ffffff","surface":"#fafafa","text":"#1a1a1a","primary":"#1a1a1a","accent":"#c9a227","muted":"#9a9a9a","border":"#ececec","card":"#ffffff","fontHead":"Cormorant Garamond","fontBody":"Inter","radius":"0rem"}'),
('Olive Grove', 'olive-grove', '{"bg":"#f5f1e8","surface":"#fbf8f1","text":"#2f3a1f","primary":"#4a5d23","accent":"#8a7a4a","muted":"#8a8366","border":"#e2dcc6","card":"#fbf8f1","fontHead":"Lora","fontBody":"Nunito Sans","radius":"0.375rem"}'),
('Sunset Terracotta', 'sunset-terracotta', '{"bg":"#fcf1ea","surface":"#fff7f1","text":"#3a1a0d","primary":"#c2410c","accent":"#9a3412","muted":"#a8745c","border":"#f1d9c8","card":"#fff7f1","fontHead":"DM Serif Display","fontBody":"Work Sans","radius":"0.75rem"}'),
('Midnight Athens', 'midnight-athens', '{"bg":"#0b1220","surface":"#121b30","text":"#e8eefc","primary":"#c0c8d8","accent":"#7ea2ff","muted":"#8b95ad","border":"#1f2a44","card":"#121b30","fontHead":"Space Grotesk","fontBody":"Inter","radius":"0.5rem"}'),
('Bloom', 'bloom', '{"bg":"#fef3f6","surface":"#fff8fa","text":"#3d1726","primary":"#db2777","accent":"#f472b6","muted":"#b48aa0","border":"#f9d3df","card":"#fff8fa","fontHead":"Playfair Display","fontBody":"Nunito","radius":"1rem"}');

-- sellers
create table public.sellers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null, slug text not null unique,
  description text, logo_url text, banner_url text,
  theme_id uuid references public.themes(id) on delete set null,
  whatsapp_number text,
  status public.seller_status not null default 'pending',
  category text, is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_sellers_status on public.sellers(status);
create index idx_sellers_slug on public.sellers(slug);
grant select on public.sellers to anon, authenticated;
grant insert, update, delete on public.sellers to authenticated;
grant all on public.sellers to service_role;
alter table public.sellers enable row level security;
create policy "Anyone can view approved sellers" on public.sellers for select
  using (status = 'approved' or auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "Users can create their own seller profile" on public.sellers for insert
  with check (auth.uid() = user_id);
create policy "Sellers can update their own profile" on public.sellers for update using (auth.uid() = user_id);
create policy "Admins can manage sellers" on public.sellers for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger update_sellers_updated_at before update on public.sellers for each row execute function public.update_updated_at_column();

create or replace function public.handle_new_seller()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role) values (new.user_id, 'seller')
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;
create trigger on_seller_created after insert on public.sellers for each row execute function public.handle_new_seller();

-- products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  name text not null, description text,
  price numeric(10,2) not null check (price >= 0),
  images text[] not null default '{}',
  stock integer not null default 0 check (stock >= 0),
  category text, variants jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_products_seller on public.products(seller_id);
create index idx_products_active on public.products(is_active);
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "Public can view active products" on public.products for select
  using (
    (is_active = true and exists (select 1 from public.sellers s where s.id = seller_id and s.status = 'approved'))
    or exists (select 1 from public.sellers s where s.id = seller_id and s.user_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );
create policy "Sellers manage their own products" on public.products for all
  using (exists (select 1 from public.sellers s where s.id = seller_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.sellers s where s.id = seller_id and s.user_id = auth.uid()));
create policy "Admins manage all products" on public.products for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger update_products_updated_at before update on public.products for each row execute function public.update_updated_at_column();

-- cart_items
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  session_id text,
  product_id uuid not null references public.products(id) on delete cascade,
  seller_id uuid not null references public.sellers(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((user_id is not null) or (session_id is not null))
);
create unique index idx_cart_user_product on public.cart_items(user_id, product_id) where user_id is not null;
create unique index idx_cart_session_product on public.cart_items(session_id, product_id) where session_id is not null;
grant select, insert, update, delete on public.cart_items to anon, authenticated;
grant all on public.cart_items to service_role;
alter table public.cart_items enable row level security;
create policy "Cart select" on public.cart_items for select
  using ((auth.uid() is not null and user_id = auth.uid()) or (auth.uid() is null and session_id is not null));
create policy "Cart insert" on public.cart_items for insert
  with check (
    (auth.uid() is not null and user_id = auth.uid() and session_id is null)
    or (auth.uid() is null and user_id is null and session_id is not null)
  );
create policy "Cart update" on public.cart_items for update
  using ((auth.uid() is not null and user_id = auth.uid()) or (auth.uid() is null and session_id is not null));
create policy "Cart delete" on public.cart_items for delete
  using ((auth.uid() is not null and user_id = auth.uid()) or (auth.uid() is null and session_id is not null));
create trigger update_cart_items_updated_at before update on public.cart_items for each row execute function public.update_updated_at_column();

-- orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete set null,
  customer_email text not null, customer_name text,
  total_amount numeric(10,2) not null check (total_amount >= 0),
  status public.order_status not null default 'pending',
  stripe_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_orders_customer on public.orders(customer_id);
create index idx_orders_status on public.orders(status);
grant select on public.orders to authenticated;
grant insert on public.orders to anon, authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create trigger update_orders_updated_at before update on public.orders for each row execute function public.update_updated_at_column();

-- order_items (created before orders policies that reference it)
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  seller_id uuid not null references public.sellers(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  price_at_purchase numeric(10,2) not null check (price_at_purchase >= 0),
  fulfilled boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_order_items_order on public.order_items(order_id);
create index idx_order_items_seller on public.order_items(seller_id);
grant select on public.order_items to authenticated;
grant insert on public.order_items to anon, authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "Customers view their own order items" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));
create policy "Sellers view their order items" on public.order_items for select
  using (exists (select 1 from public.sellers s where s.id = seller_id and s.user_id = auth.uid()));
create policy "Sellers update fulfillment on their items" on public.order_items for update
  using (exists (select 1 from public.sellers s where s.id = seller_id and s.user_id = auth.uid()));
create policy "Admins manage all order items" on public.order_items for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Now attach orders policies that reference order_items
create policy "Customers view their own orders" on public.orders for select
  using (auth.uid() = customer_id);
create policy "Sellers view orders with their items" on public.orders for select
  using (exists (
    select 1 from public.order_items oi
    join public.sellers s on s.id = oi.seller_id
    where oi.order_id = orders.id and s.user_id = auth.uid()
  ));
create policy "Admins view all orders" on public.orders for select
  using (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage orders" on public.orders for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- store_visits
create table public.store_visits (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  visited_at timestamptz not null default now(),
  source public.visit_source not null default 'direct'
);
create index idx_store_visits_seller on public.store_visits(seller_id);
create index idx_store_visits_date on public.store_visits(visited_at);
grant insert on public.store_visits to anon, authenticated;
grant select on public.store_visits to authenticated;
grant all on public.store_visits to service_role;
alter table public.store_visits enable row level security;
create policy "Anyone can log a visit" on public.store_visits for insert with check (true);
create policy "Sellers see their own visits" on public.store_visits for select
  using (exists (select 1 from public.sellers s where s.id = seller_id and s.user_id = auth.uid()));
create policy "Admins see all visits" on public.store_visits for select
  using (public.has_role(auth.uid(), 'admin'));

-- storage buckets
insert into storage.buckets (id, name, public) values
  ('store-assets', 'store-assets', true),
  ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Public read store-assets" on storage.objects for select using (bucket_id = 'store-assets');
create policy "Auth upload store-assets" on storage.objects for insert
  with check (bucket_id = 'store-assets' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owner update store-assets" on storage.objects for update
  using (bucket_id = 'store-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owner delete store-assets" on storage.objects for delete
  using (bucket_id = 'store-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Public read product-images" on storage.objects for select using (bucket_id = 'product-images');
create policy "Auth upload product-images" on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owner update product-images" on storage.objects for update
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owner delete product-images" on storage.objects for delete
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
