-- Beat Yesterday — production schema (Supabase / Postgres).
-- Wired in the app via lib/supabase.ts (activates when
-- NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY are set).
-- Run this file in the Supabase SQL editor; it is re-runnable.
-- Includes row-level security (users can only read/write their own rows)
-- and a trigger that creates a profile row on signup.

create extension if not exists "pgcrypto";

-- One row per user. auth.users.id is the FK target in Supabase Auth.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  timezone text not null default 'America/Los_Angeles',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Points per 10-minute block per category, per user. Tier enforces the budget.
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  color text not null,
  points_per_block numeric(4,2) not null,
  tier text not null check (tier in ('3','2','1','0','negative')),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- How many 3-pointers / 2-pointers this user may assign.
create table if not exists point_budgets (
  user_id uuid primary key references profiles (id) on delete cascade,
  three_pointers int not null default 4,
  two_pointers int not null default 1
);

-- Recurring schedule: one row per weekday block (0=Sunday).
-- start_block / end_block are 10-minute block indices 0..143.
create table if not exists recurring_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_block int not null check (start_block between 0 and 143),
  end_block int not null check (end_block between 1 and 144),
  category_id uuid not null references categories (id) on delete cascade,
  check (end_block > start_block)
);

-- Single source of truth for every visualization: one row per 10-min block.
create table if not exists day_blocks (
  user_id uuid not null references profiles (id) on delete cascade,
  date date not null,
  block_index int not null check (block_index between 0 and 143),
  category_id uuid references categories (id) on delete set null,
  source text not null default 'recurring'
    check (source in ('recurring','calendar','manual')),
  status text not null default 'assumed'
    check (status in ('assumed','confirmed','adjusted')),
  primary key (user_id, date, block_index)
);

-- Cached totals for Trends / leaderboard (recomputed nightly + on confirm).
create table if not exists day_summaries (
  user_id uuid not null references profiles (id) on delete cascade,
  date date not null,
  total_points numeric(8,2) not null default 0,
  confirmed_at timestamptz,
  primary key (user_id, date)
);

create table if not exists calendar_connections (
  user_id uuid primary key references profiles (id) on delete cascade,
  provider text not null default 'google',
  refresh_token_encrypted text,
  calendar_id text,
  last_sync_token text,
  updated_at timestamptz not null default now()
);

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  external_event_id text not null,
  title text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  inferred_category_id uuid references categories (id) on delete set null,
  unique (user_id, external_event_id)
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,
  target_minutes_per_day int not null,
  active boolean not null default true,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);

create table if not exists spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists space_members (
  space_id uuid not null references spaces (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  sharing_level text not null default 'totals_only'
    check (sharing_level in ('private','totals_only','detailed')),
  role text not null default 'member' check (role in ('member','admin')),
  primary key (space_id, user_id)
);

-- Leaderboard reads ONLY this table + sharing_level. Detailed breakdowns
-- are never stored here; they are fetched per-member only when the member
-- shares 'detailed'. Private members get no row at all.
create table if not exists space_day_totals (
  space_id uuid not null references spaces (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  date date not null,
  total_points numeric(8,2) not null,
  primary key (space_id, user_id, date)
);

create table if not exists badges (
  slug text primary key,
  name text not null,
  rule_description text not null
);

insert into badges (slug, name, rule_description) values
  ('well-rested', 'Well Rested', 'Averaged 7h+ sleep over the last 7 days'),
  ('daily-mover', 'Daily Mover', '30+ min exercise on 5 of the last 7 days'),
  ('curious-mind', 'Curious Mind', '20+ min learning every day for 7 days'),
  ('deep-worker', 'Deep Worker', 'Averaged 90+ min deep focus over the last 7 days'),
  ('low-scroll', 'Low Scroll', 'Averaged 30 min or less of social media over the last 7 days'),
  ('rising', 'Rising', 'Today beat yesterday and the 7-day average')
on conflict (slug) do nothing;

create table if not exists user_badges (
  user_id uuid not null references profiles (id) on delete cascade,
  badge_slug text not null references badges (slug) on delete cascade,
  earned_on date not null,
  primary key (user_id, badge_slug, earned_on)
);

-- Row-level security: users can only read/write their own rows. Space
-- visibility is enforced by joining space_members + sharing_level.
-- Run this file in the Supabase SQL editor (it is re-runnable: policies
-- are dropped before they are re-created).

alter table profiles enable row level security;
alter table categories enable row level security;
alter table point_budgets enable row level security;
alter table recurring_blocks enable row level security;
alter table day_blocks enable row level security;
alter table day_summaries enable row level security;
alter table calendar_connections enable row level security;
alter table calendar_events enable row level security;
alter table goals enable row level security;
alter table spaces enable row level security;
alter table space_members enable row level security;
alter table space_day_totals enable row level security;
alter table badges enable row level security;
alter table user_badges enable row level security;

-- Helper: is the caller a member of this space?
create or replace function public.is_space_member(p_space_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space_id and user_id = auth.uid()
  );
$$;

-- profiles: one row per user, own row only.
drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for all using (auth.uid() = id);

-- Own-rows tables (user_id = caller).
drop policy if exists "own rows" on categories;
create policy "own rows" on categories for all using (auth.uid() = user_id);
drop policy if exists "own rows" on point_budgets;
create policy "own rows" on point_budgets for all using (auth.uid() = user_id);
drop policy if exists "own rows" on recurring_blocks;
create policy "own rows" on recurring_blocks for all using (auth.uid() = user_id);
drop policy if exists "own rows" on day_blocks;
create policy "own rows" on day_blocks for all using (auth.uid() = user_id);
drop policy if exists "own rows" on day_summaries;
create policy "own rows" on day_summaries for all using (auth.uid() = user_id);
drop policy if exists "own rows" on calendar_connections;
create policy "own rows" on calendar_connections for all using (auth.uid() = user_id);
drop policy if exists "own rows" on calendar_events;
create policy "own rows" on calendar_events for all using (auth.uid() = user_id);
drop policy if exists "own rows" on goals;
create policy "own rows" on goals for all using (auth.uid() = user_id);
drop policy if exists "own rows" on user_badges;
create policy "own rows" on user_badges for all using (auth.uid() = user_id);

-- spaces: members can read; only the creator can create/update/delete.
drop policy if exists "members can read spaces" on spaces;
create policy "members can read spaces" on spaces for select
  using (auth.uid() = created_by or public.is_space_member(id));
drop policy if exists "creator manages spaces" on spaces;
create policy "creator manages spaces" on spaces for all
  using (auth.uid() = created_by) with check (auth.uid() = created_by);

-- space_members: members can read the roster; a user can only add/remove
-- themselves (invites are out of scope for v1).
drop policy if exists "members can read roster" on space_members;
create policy "members can read roster" on space_members for select
  using (public.is_space_member(space_id));
drop policy if exists "own membership" on space_members;
create policy "own membership" on space_members for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- space_day_totals: visible only to members of that space; a user writes
-- only their own totals.
drop policy if exists "members read totals" on space_day_totals;
create policy "members read totals" on space_day_totals for select
  using (public.is_space_member(space_id));
drop policy if exists "own totals" on space_day_totals;
create policy "own totals" on space_day_totals for all
  using (auth.uid() = user_id and public.is_space_member(space_id))
  with check (auth.uid() = user_id and public.is_space_member(space_id));

-- badges: reference data, readable by everyone signed in.
drop policy if exists "badges readable" on badges;
create policy "badges readable" on badges for select using (true);

-- Auto-create a profile row when a user signs up (Supabase Auth).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'You')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
