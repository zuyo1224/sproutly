-- Sproutly migration 0004：阿瓦隆 LINE 機器人
-- 跑進 Supabase SQL Editor 整段貼上即可
--
-- 獨立於 sproutly_ 系列表格之外（不是商家開店資料），只用 service_role 存取，
-- 不開放任何 anon/authenticated RLS policy —— 私人身分只能透過 lib/avalon/store.ts
-- 用 service_role client 過濾後再回傳給對應的玩家，避免整包 state 外洩。

create table if not exists avalon_games (
  id uuid primary key default gen_random_uuid(),
  line_group_id text not null unique,
  status text not null default 'lobby', -- lobby | in_progress | finished
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists avalon_games_line_group_idx on avalon_games(line_group_id);

alter table avalon_games enable row level security;
-- 故意不加任何 policy：只有 service_role（繞過 RLS）能讀寫這張表。

create or replace function avalon_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists avalon_games_set_updated_at on avalon_games;
create trigger avalon_games_set_updated_at
  before update on avalon_games
  for each row execute function avalon_set_updated_at();
