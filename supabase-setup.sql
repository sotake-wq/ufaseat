-- =========================================
-- ufaseat (UFAS社内座席管理アプリ) — Supabase セットアップSQL
-- Supabase Dashboard > SQL Editor で実行
-- =========================================

-- 1. profiles テーブル
create table if not exists public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'ユーザー',
  avatar_config jsonb,
  status      text not null default 'in_office'
            check (status in ('in_office','away','meeting','telework')),
  updated_at  timestamptz default now()
);

-- 2. seats テーブル
create table if not exists public.seats (
  seat_id     text primary key,
  occupied_by uuid references public.profiles(user_id) on delete set null,
  updated_at  timestamptz default now()
);

-- 3. 全16席を初期挿入（重複は無視）
insert into public.seats (seat_id) values
  ('A1'),('A2'),('A3'),('A4'),('A5'),('A6'),('A7'),('A8'),
  ('B1'),('B2'),('B3'),('B4'),('B5'),('B6'),('B7'),('B8')
on conflict (seat_id) do nothing;

-- 4. RLS 有効化
alter table public.profiles enable row level security;
alter table public.seats    enable row level security;

-- 5. profiles ポリシー
-- 全員が全プロフィールを閲覧可（メンバー一覧表示のため）
create policy "profiles_select_all" on public.profiles
  for select using (true);

-- 本人のみ自分のプロフィールを作成・更新
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id);

-- 6. seats ポリシー
-- 全員が座席状況を閲覧可
create policy "seats_select_all" on public.seats
  for select using (true);

-- ログインユーザーは座席を更新可（着席/離席）
create policy "seats_update_auth" on public.seats
  for update using (auth.role() = 'authenticated');

-- 7. リアルタイム有効化
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.seats;
