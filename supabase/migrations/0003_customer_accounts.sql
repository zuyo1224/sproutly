-- Sproutly migration 0003：客人會員系統
-- 跑進 Supabase SQL Editor 整段貼上即可
--
-- 變動：
-- 1. 新增 sproutly_customers 表（客人 profile，1:1 對應 auth.users）
-- 2. sproutly_orders 加 customer_id 欄位（可 null，因為匿名下單仍要保留）
-- 3. 註冊 trigger：客人首次登入時自動建 customer record
-- 4. RLS：客人能讀自己的訂單 / 訂單明細

-- ============================================================
-- 1. sproutly_customers
-- ============================================================
create table if not exists sproutly_customers (
  id uuid primary key references auth.users on delete cascade,
  email text,
  display_name text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists sproutly_customers_email_idx on sproutly_customers(email);

alter table sproutly_customers enable row level security;

create policy "sproutly_customers_select_own" on sproutly_customers
  for select using (auth.uid() = id);

create policy "sproutly_customers_update_own" on sproutly_customers
  for update using (auth.uid() = id);

create policy "sproutly_customers_insert_own" on sproutly_customers
  for insert with check (auth.uid() = id);

-- ============================================================
-- 2. sproutly_orders 加 customer_id 欄位
-- ============================================================
alter table sproutly_orders
  add column if not exists customer_id uuid references sproutly_customers(id) on delete set null;

create index if not exists sproutly_orders_customer_idx
  on sproutly_orders(customer_id);

-- ============================================================
-- 3. 客人 RLS：能讀自己的訂單（既有 owner select 規則保留）
-- ============================================================
drop policy if exists "sproutly_orders_select_customer" on sproutly_orders;
create policy "sproutly_orders_select_customer" on sproutly_orders
  for select using (auth.uid() = customer_id);

-- 訂單明細：客人也能讀自己訂單下的明細
drop policy if exists "sproutly_order_items_select_customer" on sproutly_order_items;
create policy "sproutly_order_items_select_customer" on sproutly_order_items
  for select using (
    exists (
      select 1 from sproutly_orders
      where sproutly_orders.id = sproutly_order_items.order_id
        and sproutly_orders.customer_id = auth.uid()
    )
  );

-- ============================================================
-- 4. 客人首次登入自動建 customer record
-- ============================================================
-- 注意：既有 trigger `on_auth_user_created_sproutly` 會建 sproutly_profiles（商家）。
-- 我們不改它 — 商家 / 客人都建（同一個人可以同時是商家和客人）。
-- 但客人 record 在 magic link callback 時 client-side upsert，
-- 不在 trigger 內自動建，以免污染所有 sproutly_profiles。
--
-- callback 內 upsert 邏輯由 Next.js app 處理（見 app/auth/callback/route.ts）。

-- ============================================================
-- 5. updated_at trigger
-- ============================================================
create or replace function sproutly_customers_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sproutly_customers_touch_updated on sproutly_customers;
create trigger sproutly_customers_touch_updated
  before update on sproutly_customers
  for each row execute function sproutly_customers_touch_updated_at();
