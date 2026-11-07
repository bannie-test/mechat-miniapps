-- Mini app: "Lịch âm" (lunar calendar).
-- Run once in Supabase → SQL Editor. Personal lunar-date reminders (death anniversaries,
-- lunar birthdays…), private to each user. Sharing to a chat uses the normal messages table.

create table public.lunar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  lunar_day int not null check (lunar_day between 1 and 30),
  lunar_month int not null check (lunar_month between 1 and 12),
  kind text not null default 'other' check (kind in ('death', 'birthday', 'other')),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index lunar_events_user_idx on public.lunar_events (user_id);

alter table public.lunar_events enable row level security;

create policy lunar_events_select on public.lunar_events for select to authenticated
  using (user_id = (select auth.uid()));
create policy lunar_events_insert on public.lunar_events for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy lunar_events_update on public.lunar_events for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy lunar_events_delete on public.lunar_events for delete to authenticated
  using (user_id = (select auth.uid()));

-- RLS decides rows, grants decide columns (user_id/id/created_at are not writable).
revoke all on public.lunar_events from anon, authenticated;
grant select, delete on public.lunar_events to authenticated;
grant insert (title, lunar_day, lunar_month, kind, note) on public.lunar_events to authenticated;
grant update (title, lunar_day, lunar_month, kind, note) on public.lunar_events to authenticated;

-- Register the mini app in the chat's app drawer.
-- Change the URL if your Cloudflare Pages project has a different name.
insert into public.mini_apps (id, name, description, icon, url, sort) values (
  'lunar',
  '{"en": "Lunar Calendar", "vi": "Lịch âm"}',
  '{"en": "Vietnamese lunar calendar, holidays and anniversaries", "vi": "Âm lịch, ngày lễ, ngày giỗ"}',
  '🌙',
  'https://iemanchat-apps.pages.dev/lunar/',
  20
) on conflict (id) do update set url = excluded.url, name = excluded.name, description = excluded.description;
