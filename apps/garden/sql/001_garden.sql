-- Little Garden mini app.
-- ALREADY APPLIED (it was 20261107000100_miniapp_plant.sql in the chat repo). Do not run again.

-- Mini app: "Little Garden" — water a plant once a day, watch it grow, collect seeds.
-- Clients can only read their own rows; every write goes through the RPCs below,
-- so the once-a-day rule is enforced by the server, not the browser.

create table public.plant_gardens (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  seeds int not null default 0 check (seeds >= 0),
  tz text not null default 'UTC',
  created_at timestamptz not null default now()
);

create table public.plant_plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default 'Sprout' check (char_length(name) between 1 and 24),
  variant smallint not null default 0 check (variant between 0 and 3),
  growth int not null default 0,
  health int not null default 100,        -- health as of last watering
  waterings int not null default 0,
  last_watered_on date,
  withered boolean not null default false,
  planted_at timestamptz not null default now()
);
create index plant_plants_user_idx on public.plant_plants (user_id);

alter table public.plant_gardens enable row level security;
alter table public.plant_plants enable row level security;
create policy plant_gardens_select on public.plant_gardens for select to authenticated
  using (user_id = (select auth.uid()));
create policy plant_plants_select on public.plant_plants for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.plant_gardens, public.plant_plants from anon;
revoke insert, update, delete on public.plant_gardens, public.plant_plants from authenticated;

-- Stage thresholds (growth = number of days watered)
-- 0 seed · 1 sprout · 3 seedling · 6 young · 10 mature · 14 flowering (makes seeds)
create or replace function public.plant__stage(p_growth int)
returns int language sql immutable
set search_path = ''
as $$
  select case
    when p_growth >= 14 then 5
    when p_growth >= 10 then 4
    when p_growth >= 6 then 3
    when p_growth >= 3 then 2
    when p_growth >= 1 then 1
    else 0 end
$$;

-- Health drops 20/day for each full day missed (day after the last watering is free).
create or replace function public.plant__health(p public.plant_plants, p_today date)
returns int language sql immutable
set search_path = ''
as $$
  select case
    when p.withered then 0
    when p.last_watered_on is null then p.health
    else greatest(0, p.health - greatest(0, (p_today - p.last_watered_on) - 1) * 20)
  end
$$;

create or replace function public.plant__state(p_user uuid)
returns jsonb language plpgsql security definer
set search_path = ''
as $$
declare
  v_garden public.plant_gardens;
  v_today date;
begin
  select * into v_garden from public.plant_gardens where user_id = p_user;
  v_today := (now() at time zone v_garden.tz)::date;

  -- Lazily mark plants that ran out of health.
  update public.plant_plants p set withered = true, health = 0
    where p.user_id = p_user and not p.withered and public.plant__health(p, v_today) <= 0;

  return jsonb_build_object(
    'seeds', v_garden.seeds,
    'today', v_today,
    'tz', v_garden.tz,
    'max_pots', 6,
    'plants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'variant', p.variant,
        'growth', p.growth,
        'stage', public.plant__stage(p.growth),
        'health', public.plant__health(p, v_today),
        'waterings', p.waterings,
        'last_watered_on', p.last_watered_on,
        'watered_today', p.last_watered_on = v_today,
        'withered', p.withered,
        'planted_at', p.planted_at,
        'next_seed_in', case when p.growth >= 14 then 3 - ((p.growth - 14) % 3) else null end
      ) order by p.planted_at)
      from public.plant_plants p where p.user_id = p_user
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.plant_get_state(p_tz text default 'UTC')
returns jsonb language plpgsql security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_tz text := 'UTC';
begin
  if v_me is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then v_tz := p_tz; end if;

  -- First visit: create the garden (timezone is fixed from now on) and a first seed in a pot.
  insert into public.plant_gardens (user_id, tz) values (v_me, v_tz) on conflict do nothing;
  if found then
    insert into public.plant_plants (user_id, name, variant) values (v_me, 'Sprout', floor(random() * 4)::int);
  end if;
  return public.plant__state(v_me);
end $$;

create or replace function public.plant_water(p_plant uuid)
returns jsonb language plpgsql security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_tz text;
  v_today date;
  v_plant public.plant_plants;
  v_health int;
  v_before int;
  v_gained int := 0;
begin
  select tz into v_tz from public.plant_gardens where user_id = v_me;
  if v_tz is null then raise exception 'NO_GARDEN'; end if;
  v_today := (now() at time zone v_tz)::date;

  select * into v_plant from public.plant_plants where id = p_plant and user_id = v_me for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  v_health := public.plant__health(v_plant, v_today);
  if v_health <= 0 then
    update public.plant_plants set withered = true, health = 0 where id = p_plant;
    raise exception 'PLANT_WITHERED';
  end if;
  if v_plant.last_watered_on = v_today then raise exception 'ALREADY_WATERED'; end if;

  v_before := public.plant__stage(v_plant.growth);
  update public.plant_plants set
    growth = growth + 1,
    waterings = waterings + 1,
    health = least(100, v_health + 10),
    last_watered_on = v_today
  where id = p_plant;

  -- A flowering plant drops a seed on the day it blooms and every 3rd watering after.
  if v_plant.growth + 1 >= 14 and ((v_plant.growth + 1 - 14) % 3) = 0 then
    v_gained := 1;
    update public.plant_gardens set seeds = seeds + 1 where user_id = v_me;
  end if;

  return jsonb_build_object(
    'gained_seeds', v_gained,
    'stage_up', public.plant__stage(v_plant.growth + 1) > v_before,
    'state', public.plant__state(v_me)
  );
end $$;

create or replace function public.plant_sow(p_name text default null)
returns jsonb language plpgsql security definer
set search_path = ''
as $$
declare v_me uuid := auth.uid();
begin
  perform 1 from public.plant_gardens where user_id = v_me and seeds > 0 for update;
  if not found then raise exception 'NO_SEEDS'; end if;
  if (select count(*) from public.plant_plants where user_id = v_me) >= 6 then
    raise exception 'GARDEN_FULL';
  end if;
  update public.plant_gardens set seeds = seeds - 1 where user_id = v_me;
  insert into public.plant_plants (user_id, name, variant)
    values (v_me, coalesce(nullif(left(trim(p_name), 24), ''), 'Sprout'), floor(random() * 4)::int);
  return public.plant__state(v_me);
end $$;

create or replace function public.plant_rename(p_plant uuid, p_name text)
returns jsonb language plpgsql security definer
set search_path = ''
as $$
begin
  if coalesce(trim(p_name), '') = '' then raise exception 'NAME_REQUIRED'; end if;
  update public.plant_plants set name = left(trim(p_name), 24) where id = p_plant and user_id = auth.uid();
  return public.plant__state(auth.uid());
end $$;

create or replace function public.plant_remove(p_plant uuid)
returns jsonb language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.plant_plants where id = p_plant and user_id = auth.uid();
  return public.plant__state(auth.uid());
end $$;

revoke execute on function
  public.plant__stage(int), public.plant__health(public.plant_plants, date), public.plant__state(uuid),
  public.plant_get_state(text), public.plant_water(uuid), public.plant_sow(text),
  public.plant_rename(uuid, text), public.plant_remove(uuid)
from public, anon;
grant execute on function
  public.plant_get_state(text), public.plant_water(uuid), public.plant_sow(text),
  public.plant_rename(uuid, text), public.plant_remove(uuid)
to authenticated;

-- Register the mini app. Change `url` to wherever you deploy the bundle, e.g.
--   update public.mini_apps set url = 'https://iemanchat-garden.pages.dev/' where id = 'garden';
insert into public.mini_apps (id, name, description, icon, url, sort) values (
  'garden',
  '{"en": "Little Garden", "vi": "Khu Vườn Nhỏ"}',
  '{"en": "Water your plant every day and collect seeds", "vi": "Tưới cây mỗi ngày và thu hạt giống"}',
  '🌱',
  'http://localhost:5174/',
  10
) on conflict (id) do nothing;
