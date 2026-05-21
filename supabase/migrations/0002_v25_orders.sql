-- v2.5 訂單欄位升級：加入物流方式 + 取貨門市資訊
-- 在 Supabase Dashboard > SQL Editor 整段貼上跑

alter table sproutly_orders
  add column if not exists shipping_method text,
  add column if not exists shipping_store_id text,
  add column if not exists shipping_store_name text;

-- shipping_method 可能值：
--   cvs_711 / cvs_family / cvs_hilife / home_delivery / pickup
-- shipping_store_id / shipping_store_name：超商取貨時用，store_id 是門市代號、name 是門市名稱

comment on column sproutly_orders.shipping_method is
  '物流方式：cvs_711 / cvs_family / cvs_hilife / home_delivery / pickup';
comment on column sproutly_orders.shipping_store_id is
  '超商門市代號（超商取貨時填）';
comment on column sproutly_orders.shipping_store_name is
  '超商門市名稱（超商取貨時填）';
