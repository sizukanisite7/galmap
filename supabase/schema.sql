-- GalMap schema. Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists maps (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

do $$ begin
  create type pin_category as enum ('food','sight','shop','stay','other');
exception when duplicate_object then null; end $$;

create table if not exists pins (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references maps(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  memo text not null default '' check (char_length(memo) <= 2000),
  category pin_category not null default 'other',
  visited boolean not null default false,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_by text not null check (char_length(created_by) between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists pins_map_idx on pins (map_id);

-- RLS on, no policies: direct table access is denied. Use RPCs only.
alter table maps enable row level security;
alter table pins enable row level security;
revoke all on maps, pins from anon, authenticated;

create or replace function create_map(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into maps(name) values (trim(p_name)) returning id into v_id;
  return v_id;
end $$;

create or replace function get_map(p_map_id uuid)
returns table(id uuid, name text) language sql security definer set search_path = public as $$
  select m.id, m.name from maps m where m.id = p_map_id;
$$;

create or replace function rename_map(p_map_id uuid, p_name text)
returns void language sql security definer set search_path = public as $$
  update maps set name = trim(p_name) where id = p_map_id;
$$;

create or replace function list_pins(p_map_id uuid, p_include_deleted boolean default false)
returns setof pins language sql security definer set search_path = public as $$
  select * from pins
  where map_id = p_map_id
    and (p_include_deleted or deleted_at is null)
  order by created_at desc;
$$;

-- p_pin: {id?, title, memo, category, visited, lat, lng, created_by}
create or replace function upsert_pin(p_map_id uuid, p_pin jsonb)
returns pins language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p_pin->>'id','')::uuid;
  v_row pins;
begin
  if not exists (select 1 from maps where id = p_map_id) then
    raise exception 'map not found';
  end if;

  if v_id is null then
    if (select count(*) from pins where map_id = p_map_id) >= 1000 then
      raise exception 'pin limit reached';
    end if;
    insert into pins(map_id, title, memo, category, visited, lat, lng, created_by)
    values (
      p_map_id,
      p_pin->>'title',
      coalesce(p_pin->>'memo',''),
      coalesce(p_pin->>'category','other')::pin_category,
      coalesce((p_pin->>'visited')::boolean,false),
      (p_pin->>'lat')::double precision,
      (p_pin->>'lng')::double precision,
      p_pin->>'created_by'
    ) returning * into v_row;
  else
    update pins set
      title = p_pin->>'title',
      memo = coalesce(p_pin->>'memo',''),
      category = coalesce(p_pin->>'category','other')::pin_category,
      visited = coalesce((p_pin->>'visited')::boolean,false),
      lat = (p_pin->>'lat')::double precision,
      lng = (p_pin->>'lng')::double precision,
      updated_at = now()
    where id = v_id and map_id = p_map_id
    returning * into v_row;
    if v_row.id is null then raise exception 'pin not found'; end if;
  end if;
  return v_row;
end $$;

create or replace function trash_pin(p_map_id uuid, p_pin_id uuid)
returns void language sql security definer set search_path = public as $$
  update pins set deleted_at = now(), updated_at = now()
  where id = p_pin_id and map_id = p_map_id;
$$;

create or replace function restore_pin(p_map_id uuid, p_pin_id uuid)
returns void language sql security definer set search_path = public as $$
  update pins set deleted_at = null, updated_at = now()
  where id = p_pin_id and map_id = p_map_id;
$$;

create or replace function purge_pin(p_map_id uuid, p_pin_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from pins where id = p_pin_id and map_id = p_map_id and deleted_at is not null;
$$;

grant execute on function
  create_map(text), get_map(uuid), rename_map(uuid, text),
  list_pins(uuid, boolean), upsert_pin(uuid, jsonb),
  trash_pin(uuid, uuid), restore_pin(uuid, uuid), purge_pin(uuid, uuid)
to anon, authenticated;

-- 30-day trash cleanup. Needs pg_cron (Dashboard > Database > Extensions).
-- Run this separately after enabling pg_cron:
-- select cron.schedule('galmap-purge-trash', '0 3 * * *',
--   $$delete from public.pins where deleted_at < now() - interval '30 days'$$);
