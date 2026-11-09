create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.stores (
  id text primary key,
  name text not null unique
);

create table if not exists public.manager_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.vendors (
  id text primary key,
  store_id text not null references public.stores(id),
  name text not null check (length(btrim(name)) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendors_store_active_idx on public.vendors(store_id, active, name);

create table if not exists public.prize_positions (
  id text primary key,
  store_id text not null references public.stores(id),
  slot_index integer not null check (slot_index between 0 and 39),
  name text not null check (length(btrim(name)) between 1 and 80),
  estimated_cost numeric(12, 2) not null check (estimated_cost between 0 and 1000000),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  updated_at timestamptz not null default now(),
  unique (store_id, slot_index)
);

create table if not exists public.rounds (
  id text primary key,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  store_id text not null references public.stores(id),
  store_name text not null,
  seller_id text not null references public.vendors(id) on delete restrict,
  seller_name text not null,
  prize_id text not null,
  prize_name text not null,
  position_index integer check (position_index between 0 and 39),
  estimated_cost numeric(12, 2) not null check (estimated_cost >= 0),
  wheel_snapshot jsonb,
  delivered boolean not null default false,
  delivered_at timestamptz
);

alter table public.rounds add column if not exists wheel_snapshot jsonb;

create index if not exists rounds_store_created_idx on public.rounds(store_id, created_at desc);
create index if not exists rounds_seller_created_idx on public.rounds(seller_id, created_at desc);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.spin_rate_buckets (
  bucket_start timestamptz not null,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  request_count integer not null default 0,
  primary key (bucket_start, ip_hash)
);
revoke all on private.spin_rate_buckets from public, anon, authenticated;

create table if not exists private.bootstrap_vendor_ids (
  id text primary key,
  store_id text not null,
  name text not null
);
revoke all on private.bootstrap_vendor_ids from public, anon, authenticated;

insert into public.stores (id, name) values
  ('renault-barao', 'RENAULT BARÃO'),
  ('kia-jorlan', 'KIA JORLAN'),
  ('renault-pampulha', 'RENAULT PAMPULHA')
on conflict (id) do update set name = excluded.name;

with seeded_vendors as (
  insert into public.vendors (id, store_id, name) values
  ('seed-renault-barao-01', 'renault-barao', 'LUCAS PERDIGÃO'),
  ('seed-renault-barao-02', 'renault-barao', 'LEONARDO'),
  ('seed-renault-barao-03', 'renault-barao', 'ANDRE'),
  ('seed-renault-barao-04', 'renault-barao', 'MARCIO'),
  ('seed-renault-barao-05', 'renault-barao', 'TULIO'),
  ('seed-renault-barao-06', 'renault-barao', 'BRUNO'),
  ('seed-renault-barao-07', 'renault-barao', 'CAROL'),
  ('seed-kia-jorlan-01', 'kia-jorlan', 'MATEUS'),
  ('seed-kia-jorlan-02', 'kia-jorlan', 'ROGERIO'),
  ('seed-kia-jorlan-03', 'kia-jorlan', 'GRAZIELE'),
  ('seed-renault-pampulha-01', 'renault-pampulha', 'FLAVIO'),
  ('seed-renault-pampulha-02', 'renault-pampulha', 'GABRIEL'),
  ('seed-renault-pampulha-03', 'renault-pampulha', 'RAFAELA'),
  ('seed-renault-pampulha-04', 'renault-pampulha', 'JOÃO'),
  ('seed-renault-pampulha-05', 'renault-pampulha', 'GLAUCIA'),
  ('seed-renault-pampulha-06', 'renault-pampulha', 'MARCOS')
  on conflict (id) do nothing
  returning id, store_id, name
)
insert into private.bootstrap_vendor_ids (id, store_id, name)
select id, store_id, name from seeded_vendors
on conflict (id) do nothing;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.manager_accounts
    where user_id = auth.uid()
      and active
  );
$$;

revoke all on function public.is_manager() from public, anon, authenticated;
grant execute on function public.is_manager() to authenticated;

alter table public.stores enable row level security;
alter table public.manager_accounts enable row level security;
alter table public.vendors enable row level security;
alter table public.prize_positions enable row level security;
alter table public.rounds enable row level security;

drop policy if exists stores_read on public.stores;
create policy stores_read on public.stores
  for select to anon, authenticated using (true);

drop policy if exists vendors_public_active_read on public.vendors;
create policy vendors_public_active_read on public.vendors
  for select to anon using (active);
drop policy if exists vendors_manager_read on public.vendors;
create policy vendors_manager_read on public.vendors
  for select to authenticated using (public.is_manager());
drop policy if exists vendors_manager_insert on public.vendors;
create policy vendors_manager_insert on public.vendors
  for insert to authenticated with check (public.is_manager());
drop policy if exists vendors_manager_update on public.vendors;
create policy vendors_manager_update on public.vendors
  for update to authenticated using (public.is_manager()) with check (public.is_manager());
drop policy if exists vendors_manager_delete on public.vendors;
create policy vendors_manager_delete on public.vendors
  for delete to authenticated using (public.is_manager());

drop policy if exists prizes_manager_read on public.prize_positions;
create policy prizes_manager_read on public.prize_positions
  for select to authenticated using (public.is_manager());
drop policy if exists prizes_manager_insert on public.prize_positions;
create policy prizes_manager_insert on public.prize_positions
  for insert to authenticated with check (public.is_manager());
drop policy if exists prizes_manager_update on public.prize_positions;
create policy prizes_manager_update on public.prize_positions
  for update to authenticated using (public.is_manager()) with check (public.is_manager());
drop policy if exists prizes_manager_delete on public.prize_positions;
create policy prizes_manager_delete on public.prize_positions
  for delete to authenticated using (public.is_manager());

drop policy if exists rounds_manager_read on public.rounds;
create policy rounds_manager_read on public.rounds
  for select to authenticated using (public.is_manager());
drop policy if exists rounds_manager_update_delivery on public.rounds;
create policy rounds_manager_update_delivery on public.rounds
  for update to authenticated using (public.is_manager()) with check (public.is_manager());

revoke all on public.stores, public.manager_accounts, public.vendors,
  public.prize_positions, public.rounds from anon, authenticated;
grant select on public.stores to anon, authenticated;
grant select on public.vendors to anon, authenticated;
grant select, insert, update, delete on public.vendors to authenticated;
grant select on public.prize_positions to authenticated;
grant select on public.rounds to authenticated;
grant update (delivered, delivered_at) on public.rounds to authenticated;

create or replace function public.public_wheel_config(p_store_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'store', jsonb_build_object('id', s.id, 'name', s.name),
    'vendors', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name) order by v.name)
      from public.vendors v
      where v.store_id = s.id and v.active
    ), '[]'::jsonb),
    'positions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'index', p.slot_index,
        'name', p.name,
        'cost', p.estimated_cost,
        'color', p.color
      ) order by p.slot_index)
      from public.prize_positions p
      where p.store_id = s.id
    ), '[]'::jsonb)
  )
  into result
  from public.stores s
  where s.id = p_store_id;

  if result is null then
    raise exception 'Unknown store';
  end if;
  if jsonb_array_length(result->'positions') <> 40 then
    raise exception 'Store wheel is not configured with exactly 40 positions';
  end if;
  return result;
end;
$$;

revoke all on function public.public_wheel_config(text) from public, anon, authenticated;
grant execute on function public.public_wheel_config(text) to anon, authenticated;

create or replace function private.consume_spin_rate_limit(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  current_bucket timestamptz := date_trunc('minute', clock_timestamp());
  v_request_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate limit key';
  end if;

  insert into private.spin_rate_buckets (bucket_start, ip_hash, request_count)
  values (current_bucket, p_ip_hash, 1)
  on conflict (bucket_start, ip_hash)
  do update set request_count = private.spin_rate_buckets.request_count + 1
  returning request_count into v_request_count;

  if v_request_count = 1 then
    delete from private.spin_rate_buckets
    where bucket_start < current_bucket - interval '1 day';
  end if;
  return v_request_count <= 12;
end;
$$;

revoke all on function private.consume_spin_rate_limit(text) from public, anon, authenticated;
grant execute on function private.consume_spin_rate_limit(text) to service_role;

create or replace function public.consume_spin_rate_limit(p_ip_hash text)
returns boolean
language sql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
  select private.consume_spin_rate_limit(p_ip_hash);
$$;

revoke all on function public.consume_spin_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_spin_rate_limit(text) to service_role;

create or replace function public.record_public_spin(
  p_store_id text,
  p_seller_id text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $$
declare
  existing_round public.rounds%rowtype;
  selected_store public.stores%rowtype;
  selected_vendor public.vendors%rowtype;
  selected_position public.prize_positions%rowtype;
  selected_wheel jsonb;
  random_bytes bytea;
  random_value bigint;
  selected_index integer;
  pgcrypto_schema text;
  round_id text := gen_random_uuid()::text;
  inserted_id text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;

  select * into existing_round
  from public.rounds
  where idempotency_key = p_idempotency_key;

  if found then
    if existing_round.store_id <> p_store_id or existing_round.seller_id <> p_seller_id then
      raise exception 'Idempotency key was already used for a different request';
    end if;
    return jsonb_build_object(
      'roundId', existing_round.id,
      'positionIndex', existing_round.position_index,
      'prizeId', existing_round.prize_id,
      'prizeName', existing_round.prize_name,
      'estimatedCost', existing_round.estimated_cost,
      'positions', existing_round.wheel_snapshot,
      'createdAt', existing_round.created_at,
      'delivered', existing_round.delivered
    );
  end if;

  select * into selected_store from public.stores where id = p_store_id for share;
  if not found then raise exception 'Unknown store'; end if;

  select * into selected_vendor
  from public.vendors
  where id = p_seller_id and store_id = p_store_id and active
  for share;
  if not found then raise exception 'Active seller not found for this store'; end if;

  select n.nspname into pgcrypto_schema
  from pg_catalog.pg_extension e
  join pg_catalog.pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';
  if pgcrypto_schema is null
     or pg_catalog.to_regprocedure(
       pg_catalog.format('%I.gen_random_bytes(integer)', pgcrypto_schema)
     ) is null then
    raise exception 'pgcrypto.gen_random_bytes(integer) is unavailable';
  end if;

  if (select count(*) from public.prize_positions where store_id = p_store_id) <> 40 then
    raise exception 'Store wheel is not configured with exactly 40 positions';
  end if;

  select jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'cost', p.estimated_cost,
    'color', p.color,
    'index', p.slot_index
  ) order by p.slot_index)
  into selected_wheel
  from public.prize_positions p
  where p.store_id = p_store_id;

  loop
    execute pg_catalog.format('select %I.gen_random_bytes(4)', pgcrypto_schema)
      into random_bytes;
    random_value :=
      get_byte(random_bytes, 0)::bigint * 16777216 +
      get_byte(random_bytes, 1)::bigint * 65536 +
      get_byte(random_bytes, 2)::bigint * 256 +
      get_byte(random_bytes, 3)::bigint;
    exit when random_value < 4294967280;
  end loop;
  selected_index := (random_value % 40)::integer;

  select * into selected_position
  from public.prize_positions
  where store_id = p_store_id and slot_index = selected_index;
  if not found then raise exception 'Selected wheel position is missing'; end if;

  insert into public.rounds (
    id, idempotency_key, store_id, store_name, seller_id, seller_name,
    prize_id, prize_name, position_index, estimated_cost, wheel_snapshot
  ) values (
    round_id, p_idempotency_key, selected_store.id, selected_store.name,
    selected_vendor.id, selected_vendor.name, selected_position.id,
    selected_position.name, selected_position.slot_index, selected_position.estimated_cost,
    selected_wheel
  )
  on conflict (idempotency_key) do nothing
  returning id into inserted_id;

  if inserted_id is null then
    select * into existing_round
    from public.rounds
    where idempotency_key = p_idempotency_key;
    if existing_round.store_id <> p_store_id or existing_round.seller_id <> p_seller_id then
      raise exception 'Idempotency key was already used for a different request';
    end if;
    return jsonb_build_object(
      'roundId', existing_round.id,
      'positionIndex', existing_round.position_index,
      'prizeId', existing_round.prize_id,
      'prizeName', existing_round.prize_name,
      'estimatedCost', existing_round.estimated_cost,
      'positions', existing_round.wheel_snapshot,
      'createdAt', existing_round.created_at,
      'delivered', existing_round.delivered
    );
  end if;

  return jsonb_build_object(
    'roundId', round_id,
    'positionIndex', selected_position.slot_index,
    'prizeId', selected_position.id,
    'prizeName', selected_position.name,
    'estimatedCost', selected_position.estimated_cost,
    'positions', selected_wheel,
    'createdAt', now(),
    'delivered', false
  );
end;
$$;

revoke all on function public.record_public_spin(text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_public_spin(text, text, uuid) to service_role;

create or replace function public.manager_save_store_positions(
  p_store_id text,
  p_positions jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.is_manager() then raise exception 'Manager access required'; end if;
  if jsonb_typeof(p_positions) is distinct from 'array'
     or jsonb_array_length(p_positions) <> 40 then
    raise exception 'Exactly 40 positions are required';
  end if;

  -- The same store-row lock is used by public spins (FOR SHARE).
  perform 1 from public.stores where id = p_store_id for update;
  if not found then raise exception 'Unknown store'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_positions) with ordinality item
    where jsonb_typeof(item.value) is distinct from 'object'
       or coalesce(item.value->>'id', '') = ''
       or length(item.value->>'id') > 128
       or coalesce(item.value->>'name', '') = ''
       or length(btrim(item.value->>'name')) > 80
       or coalesce(item.value->>'color', '') !~ '^#[0-9a-fA-F]{6}$'
       or jsonb_typeof(item.value->'cost') is distinct from 'number'
       or coalesce((item.value->>'cost')::numeric, -1) < 0
       or coalesce((item.value->>'cost')::numeric, 1000001) > 1000000
  ) then
    raise exception 'Invalid position data';
  end if;

  if (
    select count(distinct item.value->>'id')
    from jsonb_array_elements(p_positions) item
  ) <> 40 then
    raise exception 'Position IDs must be unique';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_positions) incoming
    join public.prize_positions existing
      on existing.id = incoming.value->>'id'
    where existing.store_id <> p_store_id
  ) then
    raise exception 'A position ID is already used by another store';
  end if;

  -- Delete/reinsert is atomic. Spins and other edits cannot observe a partial wheel.
  delete from public.prize_positions where store_id = p_store_id;
  insert into public.prize_positions (id, store_id, slot_index, name, estimated_cost, color)
  select item.value->>'id', p_store_id, (item.ordinality - 1)::integer,
         btrim(item.value->>'name'), (item.value->>'cost')::numeric, lower(item.value->>'color')
  from jsonb_array_elements(p_positions) with ordinality item;
end;
$$;

revoke all on function public.manager_save_store_positions(text, jsonb) from public, anon, authenticated;
grant execute on function public.manager_save_store_positions(text, jsonb) to authenticated;

create or replace function public.manager_import_backup(p_backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  store_row record;
  position_row record;
  vendor_row record;
  round_row record;
  existing_vendor public.vendors%rowtype;
  seed_vendor public.vendors%rowtype;
  resolved_seller_id text;
  store_configurations jsonb;
  vendors_backup jsonb;
  rounds_backup jsonb;
  configuration_count integer;
  inserted_vendors integer := 0;
  updated_vendors integer := 0;
  inserted_positions integer := 0;
  inserted_rounds integer := 0;
  round_idempotency_key uuid;
  existing_round public.rounds%rowtype;
begin
  if not public.is_manager() then raise exception 'Manager access required'; end if;
  if p_backup->>'format' is distinct from 'jorlan-sales-wheel-backup'
     or p_backup->>'version' is distinct from '1'
     or jsonb_typeof(p_backup->'data') is distinct from 'object' then
    raise exception 'Invalid Jorlan backup format';
  end if;
  if jsonb_typeof(p_backup->'data'->'storeConfigurations') is distinct from 'object'
     or p_backup->'data'->'storeConfigurations'->>'version' is distinct from '1' then
    raise exception 'Invalid store configuration object in backup';
  end if;
  store_configurations := p_backup->'data'->'storeConfigurations'->'stores';
  if jsonb_typeof(store_configurations) is distinct from 'object' then
    raise exception 'Backup must contain all three store configurations';
  end if;
  select count(*) into configuration_count
  from jsonb_object_keys(store_configurations);
  if configuration_count <> 3 then
    raise exception 'Backup must contain exactly three store configurations';
  end if;

  vendors_backup := p_backup->'data'->'vendors';
  rounds_backup := coalesce(p_backup->'data'->'rounds', '[]'::jsonb);
  if jsonb_typeof(vendors_backup) is distinct from 'array'
     or jsonb_typeof(rounds_backup) is distinct from 'array' then
    raise exception 'Backup vendors and rounds must be arrays';
  end if;

  if exists (
    select 1 from public.stores s
    where not (store_configurations ? s.id)
  ) or exists (
    select 1
    from jsonb_object_keys(store_configurations) cfg(store_id)
    where not exists (select 1 from public.stores s where s.id = cfg.store_id)
  ) then
    raise exception 'Backup store IDs do not match the three configured stores';
  end if;

  -- Acquire store locks in a stable order; public spins and wheel edits use them too.
  perform s.id from public.stores s order by s.id for update;

  for store_row in
    select key as store_id, value as positions
    from jsonb_each(store_configurations)
  loop
    if jsonb_typeof(store_row.positions) is distinct from 'array'
       or jsonb_array_length(store_row.positions) <> 40 then
      raise exception 'Store % must have exactly 40 positions', store_row.store_id;
    end if;

    if exists (
      select 1
      from jsonb_array_elements(store_row.positions) item
      where jsonb_typeof(item.value) is distinct from 'object'
         or coalesce(item.value->>'id', '') = ''
         or length(item.value->>'id') > 128
         or coalesce(item.value->>'name', '') = ''
         or length(btrim(item.value->>'name')) > 80
         or jsonb_typeof(item.value->'cost') is distinct from 'number'
         or coalesce((item.value->>'cost')::numeric, -1) < 0
         or coalesce((item.value->>'cost')::numeric, 1000001) > 1000000
         or coalesce(item.value->>'color', '') !~ '^#[0-9a-fA-F]{6}$'
    ) then
      raise exception 'Invalid position data for store %', store_row.store_id;
    end if;
    if (
      select count(distinct item.value->>'id')
      from jsonb_array_elements(store_row.positions) item
    ) <> 40 then
      raise exception 'Position IDs must be unique within store %', store_row.store_id;
    end if;

    for position_row in
      select value as item, (ordinality - 1)::integer as slot_index
      from jsonb_array_elements(store_row.positions) with ordinality
    loop
      if exists (
        select 1
        from public.prize_positions existing
        where existing.id = position_row.item->>'id'
          and (
            existing.store_id <> store_row.store_id
            or existing.slot_index <> position_row.slot_index
            or existing.name <> btrim(position_row.item->>'name')
            or existing.estimated_cost <> (position_row.item->>'cost')::numeric
            or existing.color <> lower(position_row.item->>'color')
          )
      ) then
        raise exception 'Position ID conflict in store % at slot %', store_row.store_id, position_row.slot_index;
      end if;
      if exists (
        select 1
        from public.prize_positions existing
        where existing.store_id = store_row.store_id
          and existing.slot_index = position_row.slot_index
          and existing.id <> position_row.item->>'id'
      ) then
        raise exception 'Position conflict in store % at slot %', store_row.store_id, position_row.slot_index;
      end if;
      if not exists (
        select 1 from public.prize_positions existing
        where existing.id = position_row.item->>'id'
      ) then
        insert into public.prize_positions (id, store_id, slot_index, name, estimated_cost, color)
        values (
          position_row.item->>'id', store_row.store_id, position_row.slot_index,
          btrim(position_row.item->>'name'), (position_row.item->>'cost')::numeric,
          lower(position_row.item->>'color')
        );
        inserted_positions := inserted_positions + 1;
      end if;
    end loop;
    if (select count(*) from public.prize_positions where store_id = store_row.store_id) <> 40 then
      raise exception 'Store % did not end with exactly 40 positions', store_row.store_id;
    end if;
  end loop;

  for vendor_row in
    select value as item from jsonb_array_elements(vendors_backup)
  loop
    if jsonb_typeof(vendor_row.item) is distinct from 'object'
       or coalesce(vendor_row.item->>'id', '') = ''
       or length(vendor_row.item->>'id') > 128
       or coalesce(vendor_row.item->>'name', '') = ''
       or length(btrim(vendor_row.item->>'name')) > 80
       or not exists (
         select 1 from public.stores s where s.id = vendor_row.item->>'storeId'
       )
       or (vendor_row.item ? 'active' and
           jsonb_typeof(vendor_row.item->'active') is distinct from 'boolean') then
      raise exception 'Invalid vendor data in backup';
    end if;

    select * into existing_vendor
    from public.vendors v
    where v.id = vendor_row.item->>'id'
    for update;

    if found then
      if exists (
        select 1 from private.bootstrap_vendor_ids seeded
        where seeded.id = existing_vendor.id
      ) then
        update public.vendors
        set store_id = vendor_row.item->>'storeId',
            name = btrim(vendor_row.item->>'name'),
            active = coalesce((vendor_row.item->>'active')::boolean, true),
            updated_at = now()
        where id = existing_vendor.id;
        updated_vendors := updated_vendors + 1;
      elsif existing_vendor.store_id <> vendor_row.item->>'storeId'
         or lower(existing_vendor.name) <> lower(btrim(vendor_row.item->>'name')) then
        raise exception 'Vendor ID conflict in backup: %', vendor_row.item->>'id';
      end if;
      delete from private.bootstrap_vendor_ids where id = vendor_row.item->>'id';
      continue;
    end if;

    select v.* into seed_vendor
    from public.vendors v
    join private.bootstrap_vendor_ids seeded on seeded.id = v.id
    where lower(seeded.name) = lower(btrim(vendor_row.item->>'name'))
      and (
        seeded.store_id = vendor_row.item->>'storeId'
        or (
          select count(*)
          from private.bootstrap_vendor_ids same_name
          where lower(same_name.name) = lower(btrim(vendor_row.item->>'name'))
        ) = 1
      )
    order by (seeded.store_id = vendor_row.item->>'storeId') desc, v.id
    limit 1
    for update of v;

    if found then
      if not exists (
        select 1 from public.rounds r where r.seller_id = seed_vendor.id
      ) then
        update public.vendors
        set id = vendor_row.item->>'id',
            store_id = vendor_row.item->>'storeId',
            name = btrim(vendor_row.item->>'name'),
            active = coalesce((vendor_row.item->>'active')::boolean, true),
            updated_at = now()
        where id = seed_vendor.id;
        updated_vendors := updated_vendors + 1;
        delete from private.bootstrap_vendor_ids where id = seed_vendor.id;
        continue;
      end if;
    end if;

    select * into existing_vendor
    from public.vendors v
    where v.store_id = vendor_row.item->>'storeId'
      and lower(v.name) = lower(btrim(vendor_row.item->>'name'))
    order by v.id
    limit 1
    for update;
    if found then
      continue;
    end if;

    insert into public.vendors (id, store_id, name, active)
    values (
      vendor_row.item->>'id',
      vendor_row.item->>'storeId',
      btrim(vendor_row.item->>'name'),
      coalesce((vendor_row.item->>'active')::boolean, true)
    );
    inserted_vendors := inserted_vendors + 1;
  end loop;

  for round_row in
    select value as item from jsonb_array_elements(rounds_backup)
  loop
    if jsonb_typeof(round_row.item) is distinct from 'object'
       or coalesce(round_row.item->>'id', '') = ''
       or length(round_row.item->>'id') > 128
       or not exists (select 1 from public.stores s where s.id = round_row.item->>'storeId')
       or coalesce(round_row.item->>'sellerId', '') = ''
       or coalesce(round_row.item->>'sellerName', '') = ''
       or coalesce(round_row.item->>'prizeId', '') = ''
       or coalesce(round_row.item->>'prizeName', '') = ''
       or round_row.item->>'date' is null
       or jsonb_typeof(round_row.item->'estimatedCost') is distinct from 'number'
       or coalesce((round_row.item->>'estimatedCost')::numeric, -1) < 0
       or (round_row.item ? 'delivered' and
           jsonb_typeof(round_row.item->'delivered') is distinct from 'boolean')
       or (round_row.item ? 'positionIndex' and
           round_row.item->>'positionIndex' <> '' and
           (round_row.item->>'positionIndex')::integer not between 0 and 39) then
      raise exception 'Invalid round data in backup';
    end if;

    resolved_seller_id := round_row.item->>'sellerId';
    if not exists (
      select 1 from public.vendors v where v.id = resolved_seller_id
    ) then
      select v.id into resolved_seller_id
      from public.vendors v
      where v.store_id = round_row.item->>'storeId'
        and lower(v.name) = lower(btrim(round_row.item->>'sellerName'))
      order by v.id
      limit 1;
    end if;
    if resolved_seller_id is null then
      raise exception 'No vendor matches historical seller %', round_row.item->>'sellerName';
    end if;

    round_idempotency_key := coalesce(
      nullif(round_row.item->>'idempotencyKey', '')::uuid,
      md5(round_row.item->>'id')::uuid
    );
    if exists (
      select 1 from public.rounds r
      where r.id = round_row.item->>'id'
        and r.idempotency_key <> round_idempotency_key
    ) or exists (
      select 1 from public.rounds r
      where r.idempotency_key = round_idempotency_key
        and r.id <> round_row.item->>'id'
    ) then
      raise exception 'Round ID/idempotency conflict in backup: %', round_row.item->>'id';
    end if;

    select * into existing_round
    from public.rounds r
    where r.id = round_row.item->>'id'
    for update;
    if found then
      if existing_round.idempotency_key <> round_idempotency_key
         or existing_round.created_at <> (round_row.item->>'date')::timestamptz
         or existing_round.store_id <> round_row.item->>'storeId'
         or existing_round.store_name <> round_row.item->>'storeName'
         or existing_round.seller_id <> resolved_seller_id
         or existing_round.seller_name <> round_row.item->>'sellerName'
         or existing_round.prize_id <> round_row.item->>'prizeId'
         or existing_round.prize_name <> round_row.item->>'prizeName'
         or existing_round.position_index is distinct from
            nullif(round_row.item->>'positionIndex', '')::integer
         or existing_round.estimated_cost <> (round_row.item->>'estimatedCost')::numeric then
        raise exception 'Round ID/idempotency conflict in backup: %', round_row.item->>'id';
      end if;
      continue;
    end if;

    insert into public.rounds (
      id, idempotency_key, created_at, store_id, store_name, seller_id, seller_name,
      prize_id, prize_name, position_index, estimated_cost, delivered, delivered_at
    ) values (
      round_row.item->>'id',
      round_idempotency_key,
      (round_row.item->>'date')::timestamptz,
      round_row.item->>'storeId', round_row.item->>'storeName',
      resolved_seller_id, round_row.item->>'sellerName',
      round_row.item->>'prizeId', round_row.item->>'prizeName',
      nullif(round_row.item->>'positionIndex', '')::integer,
      (round_row.item->>'estimatedCost')::numeric,
      coalesce((round_row.item->>'delivered')::boolean, false),
      nullif(round_row.item->>'deliveredAt', '')::timestamptz
    );
    inserted_rounds := inserted_rounds + 1;
  end loop;

  return jsonb_build_object(
    'insertedVendors', inserted_vendors,
    'updatedSeedVendors', updated_vendors,
    'insertedPositions', inserted_positions,
    'insertedRounds', inserted_rounds
  );
end;
$$;

revoke all on function public.manager_import_backup(jsonb) from public, anon, authenticated;
grant execute on function public.manager_import_backup(jsonb) to authenticated;

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['vendors', 'prize_positions', 'rounds']
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;
