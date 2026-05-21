-- Sproutly 資料表 schema v1
-- 與 avalon-bot 共用同一個 Supabase project，全部表加 `sproutly_` prefix 隔離
-- 在 Supabase Dashboard > SQL Editor 整段貼上跑

-- ============================================================
-- 1. sproutly_profiles（商家擁有者個人資料，擴充 auth.users）
-- ============================================================
create table if not exists sproutly_profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table sproutly_profiles enable row level security;

create policy "sproutly_profiles_select_own" on sproutly_profiles
  for select using (auth.uid() = id);

create policy "sproutly_profiles_update_own" on sproutly_profiles
  for update using (auth.uid() = id);

create policy "sproutly_profiles_insert_own" on sproutly_profiles
  for insert with check (auth.uid() = id);

-- 註冊時自動建 sproutly_profile（trigger 名加 prefix 避免跟其他 app 撞）
create or replace function sproutly_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sproutly_profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_sproutly on auth.users;
create trigger on_auth_user_created_sproutly
  after insert on auth.users
  for each row execute function sproutly_handle_new_user();

-- ============================================================
-- 2. sproutly_merchants（店家）
-- ============================================================
create table if not exists sproutly_merchants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references sproutly_profiles(id) on delete cascade,
  slug text unique not null,
  name text not null,
  description text,
  logo_url text,
  cover_url text,
  contact_phone text,
  contact_email text,
  address text,
  business_hours jsonb,
  faq jsonb,
  theme jsonb default '{}'::jsonb,
  is_published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists sproutly_merchants_owner_idx on sproutly_merchants(owner_id);
create index if not exists sproutly_merchants_slug_idx on sproutly_merchants(slug);

alter table sproutly_merchants enable row level security;

create policy "sproutly_merchants_select_public" on sproutly_merchants
  for select using (is_published = true or auth.uid() = owner_id);

create policy "sproutly_merchants_insert_own" on sproutly_merchants
  for insert with check (auth.uid() = owner_id);

create policy "sproutly_merchants_update_own" on sproutly_merchants
  for update using (auth.uid() = owner_id);

create policy "sproutly_merchants_delete_own" on sproutly_merchants
  for delete using (auth.uid() = owner_id);

-- ============================================================
-- 3. sproutly_products（商品）
-- ============================================================
create table if not exists sproutly_products (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references sproutly_merchants(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null,
  currency text default 'TWD',
  image_urls text[] default '{}',
  stock integer,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists sproutly_products_merchant_idx on sproutly_products(merchant_id);

alter table sproutly_products enable row level security;

create policy "sproutly_products_select_public" on sproutly_products
  for select using (
    (is_active = true and exists (
      select 1 from sproutly_merchants
      where sproutly_merchants.id = sproutly_products.merchant_id
        and sproutly_merchants.is_published = true
    ))
    or exists (
      select 1 from sproutly_merchants
      where sproutly_merchants.id = sproutly_products.merchant_id
        and sproutly_merchants.owner_id = auth.uid()
    )
  );

create policy "sproutly_products_insert_owner" on sproutly_products
  for insert with check (
    exists (
      select 1 from sproutly_merchants
      where sproutly_merchants.id = sproutly_products.merchant_id
        and sproutly_merchants.owner_id = auth.uid()
    )
  );

create policy "sproutly_products_update_owner" on sproutly_products
  for update using (
    exists (
      select 1 from sproutly_merchants
      where sproutly_merchants.id = sproutly_products.merchant_id
        and sproutly_merchants.owner_id = auth.uid()
    )
  );

create policy "sproutly_products_delete_owner" on sproutly_products
  for delete using (
    exists (
      select 1 from sproutly_merchants
      where sproutly_merchants.id = sproutly_products.merchant_id
        and sproutly_merchants.owner_id = auth.uid()
    )
  );

-- ============================================================
-- 4. sproutly_orders（訂單）
-- ============================================================
create table if not exists sproutly_orders (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references sproutly_merchants(id) on delete restrict,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  shipping_address text,
  note text,
  total_cents integer not null,
  currency text default 'TWD',
  status text not null default 'pending',
    -- pending / confirmed / shipped / completed / cancelled
  payment_method text,
    -- linepay / jkos / paypal / credit_card / transfer
  payment_status text default 'unpaid',
    -- unpaid / paid / refunded
  paid_at timestamptz,
  shipped_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists sproutly_orders_merchant_idx on sproutly_orders(merchant_id);
create index if not exists sproutly_orders_merchant_status_idx
  on sproutly_orders(merchant_id, status);

alter table sproutly_orders enable row level security;

create policy "sproutly_orders_select_owner" on sproutly_orders
  for select using (
    exists (
      select 1 from sproutly_merchants
      where sproutly_merchants.id = sproutly_orders.merchant_id
        and sproutly_merchants.owner_id = auth.uid()
    )
  );

create policy "sproutly_orders_insert_anon" on sproutly_orders
  for insert with check (true);

create policy "sproutly_orders_update_owner" on sproutly_orders
  for update using (
    exists (
      select 1 from sproutly_merchants
      where sproutly_merchants.id = sproutly_orders.merchant_id
        and sproutly_merchants.owner_id = auth.uid()
    )
  );

-- ============================================================
-- 5. sproutly_order_items（訂單明細）
-- ============================================================
create table if not exists sproutly_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references sproutly_orders(id) on delete cascade,
  product_id uuid references sproutly_products(id) on delete set null,
  name_snapshot text not null,
  price_cents_snapshot integer not null,
  quantity integer not null default 1
);

create index if not exists sproutly_order_items_order_idx on sproutly_order_items(order_id);

alter table sproutly_order_items enable row level security;

create policy "sproutly_order_items_select_owner" on sproutly_order_items
  for select using (
    exists (
      select 1 from sproutly_orders
      join sproutly_merchants on sproutly_merchants.id = sproutly_orders.merchant_id
      where sproutly_orders.id = sproutly_order_items.order_id
        and sproutly_merchants.owner_id = auth.uid()
    )
  );

create policy "sproutly_order_items_insert_anon" on sproutly_order_items
  for insert with check (true);

-- ============================================================
-- 6. sproutly_subscriptions（平台訂閱：商家付平台月費）
-- ============================================================
create table if not exists sproutly_subscriptions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid unique not null references sproutly_merchants(id) on delete cascade,
  plan text not null default 'free',
    -- free / basic / pro
  status text not null default 'active',
    -- active / past_due / cancelled
  started_at timestamptz default now(),
  current_period_end timestamptz,
  cancel_at timestamptz,
  external_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists sproutly_subscriptions_merchant_idx
  on sproutly_subscriptions(merchant_id);

alter table sproutly_subscriptions enable row level security;

create policy "sproutly_subscriptions_select_owner" on sproutly_subscriptions
  for select using (
    exists (
      select 1 from sproutly_merchants
      where sproutly_merchants.id = sproutly_subscriptions.merchant_id
        and sproutly_merchants.owner_id = auth.uid()
    )
  );

-- ============================================================
-- updated_at 自動更新（函數加 sproutly_ prefix 避免撞）
-- ============================================================
create or replace function sproutly_update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sproutly_profiles_updated_at on sproutly_profiles;
create trigger sproutly_profiles_updated_at before update on sproutly_profiles
  for each row execute function sproutly_update_updated_at();

drop trigger if exists sproutly_merchants_updated_at on sproutly_merchants;
create trigger sproutly_merchants_updated_at before update on sproutly_merchants
  for each row execute function sproutly_update_updated_at();

drop trigger if exists sproutly_products_updated_at on sproutly_products;
create trigger sproutly_products_updated_at before update on sproutly_products
  for each row execute function sproutly_update_updated_at();

drop trigger if exists sproutly_orders_updated_at on sproutly_orders;
create trigger sproutly_orders_updated_at before update on sproutly_orders
  for each row execute function sproutly_update_updated_at();

drop trigger if exists sproutly_subscriptions_updated_at on sproutly_subscriptions;
create trigger sproutly_subscriptions_updated_at before update on sproutly_subscriptions
  for each row execute function sproutly_update_updated_at();
