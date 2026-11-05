-- Habit Tracker: Supabase schema.
-- Paste this whole file into the Supabase SQL editor and press Run.
-- It is safe to run again: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- Tables: one row per habit, one row per habit per day.
-- `updated_at` is the device's edit time (last write wins).
-- `synced_at` is set by the server on every write; devices pull by it.
-- ---------------------------------------------------------------------------

create table if not exists public.habits (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  icon text,
  color text not null,
  type text not null check (type in ('boolean', 'count', 'duration')),
  target integer not null check (target >= 1),
  unit text,
  schedule jsonb not null,
  reminder_time text,
  sort_order integer not null default 0,
  created_at timestamptz not null,
  archived_at timestamptz,
  updated_at timestamptz not null,
  deleted boolean not null default false,
  synced_at timestamptz not null default clock_timestamp()
);

create table if not exists public.entries (
  id text primary key, -- '<habit id>:<YYYY-MM-DD>'
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null,
  date date not null,
  value integer not null check (value >= 0),
  note text,
  updated_at timestamptz not null,
  deleted boolean not null default false,
  synced_at timestamptz not null default clock_timestamp()
);

create index if not exists habits_user_synced on public.habits (user_id, synced_at);
create index if not exists entries_user_synced on public.entries (user_id, synced_at);

create or replace function public.set_synced_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists habits_synced_at on public.habits;
create trigger habits_synced_at before insert or update on public.habits
  for each row execute function public.set_synced_at();

drop trigger if exists entries_synced_at on public.entries;
create trigger entries_synced_at before insert or update on public.entries
  for each row execute function public.set_synced_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: each user can only see and change their own rows.
-- ---------------------------------------------------------------------------

alter table public.habits enable row level security;
alter table public.entries enable row level security;

drop policy if exists "own habits" on public.habits;
create policy "own habits" on public.habits for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own entries" on public.entries;
create policy "own entries" on public.entries for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- push_changes: upload a batch of local changes in one call.
-- A row is only overwritten when the incoming edit is newer (last write wins),
-- so an old device coming back online can't undo newer edits.
-- Runs as the caller (security invoker), so RLS still applies.
-- ---------------------------------------------------------------------------

create or replace function public.push_changes(
  p_habits jsonb default '[]'::jsonb,
  p_entries jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.habits as h (
    id, name, icon, color, type, target, unit, schedule, reminder_time,
    sort_order, created_at, archived_at, updated_at, deleted
  )
  select
    x.id, x.name, x.icon, x.color, x.type, x.target, x.unit, x.schedule, x.reminder_time,
    x.sort_order, x.created_at, x.archived_at, x.updated_at, coalesce(x.deleted, false)
  from jsonb_to_recordset(p_habits) as x (
    id uuid, name text, icon text, color text, type text, target integer, unit text,
    schedule jsonb, reminder_time text, sort_order integer, created_at timestamptz,
    archived_at timestamptz, updated_at timestamptz, deleted boolean
  )
  on conflict (id) do update set
    name = excluded.name,
    icon = excluded.icon,
    color = excluded.color,
    type = excluded.type,
    target = excluded.target,
    unit = excluded.unit,
    schedule = excluded.schedule,
    reminder_time = excluded.reminder_time,
    sort_order = excluded.sort_order,
    created_at = excluded.created_at,
    archived_at = excluded.archived_at,
    updated_at = excluded.updated_at,
    deleted = excluded.deleted
  where excluded.updated_at > h.updated_at;

  insert into public.entries as e (id, habit_id, date, value, note, updated_at, deleted)
  select x.id, x.habit_id, x.date, x.value, x.note, x.updated_at, coalesce(x.deleted, false)
  from jsonb_to_recordset(p_entries) as x (
    id text, habit_id uuid, date date, value integer, note text,
    updated_at timestamptz, deleted boolean
  )
  on conflict (id) do update set
    habit_id = excluded.habit_id,
    date = excluded.date,
    value = excluded.value,
    note = excluded.note,
    updated_at = excluded.updated_at,
    deleted = excluded.deleted
  where excluded.updated_at > e.updated_at;
end;
$$;

revoke all on function public.push_changes(jsonb, jsonb) from public, anon;
grant execute on function public.push_changes(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- ping: a tiny public call the keep-alive GitHub Action makes every 2 days,
-- so the free project is never paused for inactivity. It reads no data.
-- ---------------------------------------------------------------------------

create or replace function public.ping()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

grant execute on function public.ping() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Single-user lock: once one account exists, refuse to create another.
-- (Also turn off "Allow new users to sign up" in Auth settings.)
-- ---------------------------------------------------------------------------

create or replace function public.only_one_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from auth.users) then
    raise exception 'This Habit Tracker accepts only one account.';
  end if;
  return new;
end;
$$;

drop trigger if exists only_one_user on auth.users;
create trigger only_one_user before insert on auth.users
  for each row execute function public.only_one_user();

-- ---------------------------------------------------------------------------
-- Realtime: tell other devices about changes as they happen.
-- ---------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table public.habits;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.entries;
exception when duplicate_object then null;
end;
$$;
