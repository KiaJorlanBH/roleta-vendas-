-- Run in Supabase SQL Editor after the migration and manager account setup,
-- but before importing the real local backup. All test writes are rolled back.
begin;

do $$
declare
  store_count integer;
  vendor_count integer;
  marker_count integer;
begin
  select count(*) into store_count from public.stores;
  if store_count <> 3 then
    raise exception 'Expected 3 stores, found %', store_count;
  end if;

  if exists (
    select 1
    from (values
      ('renault-barao', 'RENAULT BARÃO'),
      ('kia-jorlan', 'KIA JORLAN'),
      ('renault-pampulha', 'RENAULT PAMPULHA')
    ) expected(store_id, name)
    left join public.stores actual on actual.id = expected.store_id and actual.name = expected.name
    where actual.id is null
  ) then
    raise exception 'Store IDs or names do not match the expected three stores';
  end if;

  select count(*) into vendor_count from public.vendors;
  if vendor_count <> 16 then
    raise exception 'Expected 16 initial vendors before backup import, found %', vendor_count;
  end if;

  if exists (
    select 1
    from (values
      ('renault-barao', 'LUCAS PERDIGÃO'), ('renault-barao', 'LEONARDO'),
      ('renault-barao', 'ANDRE'), ('renault-barao', 'MARCIO'),
      ('renault-barao', 'TULIO'), ('renault-barao', 'BRUNO'),
      ('renault-barao', 'CAROL'), ('kia-jorlan', 'MATEUS'),
      ('kia-jorlan', 'ROGERIO'), ('kia-jorlan', 'GRAZIELE'),
      ('renault-pampulha', 'FLAVIO'), ('renault-pampulha', 'GABRIEL'),
      ('renault-pampulha', 'RAFAELA'), ('renault-pampulha', 'JOÃO'),
      ('renault-pampulha', 'GLAUCIA'), ('renault-pampulha', 'MARCOS')
    ) expected(store_id, name)
    left join public.vendors actual
      on actual.store_id = expected.store_id and actual.name = expected.name
    where actual.id is null
  ) then
    raise exception 'The initial vendor names do not match the expected list';
  end if;

  select count(*) into marker_count from private.bootstrap_vendor_ids;
  if marker_count <> 16 then
    raise exception 'Expected 16 unimported bootstrap vendor markers; run this test before the real backup import (found %)', marker_count;
  end if;

  if exists (
    select 1
    from public.stores s
    left join public.prize_positions p on p.store_id = s.id
    group by s.id
    having count(p.id) not in (0, 40)
  ) then
    raise exception 'A store has a partial wheel; fix it before running import tests';
  end if;

  if exists (
    select 1
    from (values
      ('public.stores'::regclass),
      ('public.manager_accounts'::regclass),
      ('public.vendors'::regclass),
      ('public.prize_positions'::regclass),
      ('public.rounds'::regclass)
    ) target(table_oid)
    join pg_class c on c.oid = target.table_oid
    where not c.relrowsecurity
  ) then
    raise exception 'RLS is not enabled on every application table';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vendors'
      and policyname = 'vendors_public_active_read'
  ) or exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rounds'
      and 'anon' = any(roles)
  ) then
    raise exception 'Public vendor visibility or round-history RLS policy is incorrect';
  end if;

  if has_table_privilege('anon', 'public.rounds', 'SELECT')
     or has_table_privilege('anon', 'public.prize_positions', 'SELECT')
     or has_table_privilege('anon', 'public.vendors', 'INSERT')
     or has_table_privilege('anon', 'public.vendors', 'UPDATE')
     or has_table_privilege('anon', 'public.vendors', 'DELETE')
     or has_schema_privilege('anon', 'private', 'USAGE') then
    raise exception 'Anonymous users have a direct privilege that must remain private';
  end if;

  if has_function_privilege('anon', 'public.record_public_spin(text,text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.record_public_spin(text,text,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.record_public_spin(text,text,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.manager_save_store_positions(text,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.manager_import_backup(jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.manager_save_store_positions(text,jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.manager_import_backup(jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.consume_spin_rate_limit(text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.consume_spin_rate_limit(text)', 'EXECUTE')
     or not has_function_privilege('anon', 'public.public_wheel_config(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.is_manager()', 'EXECUTE') then
    raise exception 'Function EXECUTE permissions do not match the public/admin boundary';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and n.nspname in ('public', 'private')
      and p.proname in (
        'is_manager', 'public_wheel_config', 'consume_spin_rate_limit',
        'record_public_spin', 'manager_save_store_positions', 'manager_import_backup'
      )
      and not exists (
        select 1 from unnest(p.proconfig) as settings(config)
        where config like 'search_path=%'
      )
  ) then
    raise exception 'A SECURITY DEFINER function is missing a fixed search_path';
  end if;

  if not exists (select 1 from public.manager_accounts where active) then
    raise exception 'Create and activate the manager account before running import tests';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from public.manager_accounts where active order by created_at limit 1),
  true
);

do $$
declare
  store_row record;
  wheel_positions jsonb;
  wheel_count integer;
  store_configurations jsonb := '{}'::jsonb;
  backup_vendors jsonb;
  backup_rounds jsonb;
  backup_payload jsonb;
  first_import jsonb;
  second_import jsonb;
  spin_result jsonb;
  repeated_spin_result jsonb;
  active_seller_id text;
  sample_seller_id text;
  sample_seller_name text;
  sample_prize jsonb;
  baseline_rounds integer;
  i integer;
begin
  for store_row in select id from public.stores order by id loop
    select count(*), coalesce(
      jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'cost', p.estimated_cost,
        'color', p.color
      ) order by p.slot_index),
      '[]'::jsonb
    )
    into wheel_count, wheel_positions
    from public.prize_positions p
    where p.store_id = store_row.id;

    if wheel_count = 0 then
      wheel_positions := '[]'::jsonb;
      for i in 0..39 loop
        wheel_positions := wheel_positions || jsonb_build_array(jsonb_build_object(
          'id', format('migration-test-%s-%s', store_row.id, lpad(i::text, 2, '0')),
          'name', format('Prêmio de teste %s', i + 1),
          'cost', 1,
          'color', '#2563eb'
        ));
      end loop;
    elsif wheel_count <> 40 then
      raise exception 'Store % has % wheel positions; expected 0 or 40', store_row.id, wheel_count;
    end if;

    store_configurations := store_configurations ||
      jsonb_build_object(store_row.id, wheel_positions);
  end loop;

  select jsonb_agg(jsonb_build_object(
    'id', 'backup-test-' || v.id,
    'storeId', v.store_id,
    'name', v.name,
    'active', v.active
  ) order by v.id)
  into backup_vendors
  from private.bootstrap_vendor_ids seeded
  join public.vendors v on v.id = seeded.id;

  select vendor.value->>'id', vendor.value->>'name'
  into sample_seller_id, sample_seller_name
  from jsonb_array_elements(backup_vendors) vendor(value)
  where vendor.value->>'storeId' = 'renault-barao'
  order by vendor.value->>'id'
  limit 1;
  sample_prize := store_configurations->'renault-barao'->0;
  backup_rounds := jsonb_build_array(jsonb_build_object(
    'id', 'migration-test-round-0001',
    'date', now() - interval '1 minute',
    'storeId', 'renault-barao',
    'storeName', 'RENAULT BARÃO',
    'sellerId', sample_seller_id,
    'sellerName', sample_seller_name,
    'prizeId', sample_prize->>'id',
    'prizeName', sample_prize->>'name',
    'positionIndex', 0,
    'estimatedCost', (sample_prize->>'cost')::numeric,
    'delivered', false,
    'deliveredAt', null
  ));

  backup_payload := jsonb_build_object(
    'format', 'jorlan-sales-wheel-backup',
    'version', 1,
    'createdAt', now(),
    'data', jsonb_build_object(
      'legacyConfiguration', null,
      'storeConfigurations', jsonb_build_object(
        'version', 1,
        'stores', store_configurations
      ),
      'vendors', backup_vendors,
      'rounds', backup_rounds
    )
  );

  first_import := public.manager_import_backup(backup_payload);
  if (first_import->>'insertedVendors')::integer <> 0
     or (first_import->>'updatedSeedVendors')::integer <> 16
     or (first_import->>'insertedRounds')::integer <> 1 then
    raise exception 'Seed reconciliation failed: %', first_import;
  end if;

  if (select count(*) from public.vendors) <> 16 then
    raise exception 'Vendor reconciliation created duplicate initial vendors';
  end if;
  if exists (
    select 1 from public.stores s
    left join public.prize_positions p on p.store_id = s.id
    group by s.id having count(p.id) <> 40
  ) then
    raise exception 'Import did not leave exactly 40 positions for every store';
  end if;

  second_import := public.manager_import_backup(backup_payload);
  if coalesce((second_import->>'insertedVendors')::integer, -1) <> 0
     or coalesce((second_import->>'updatedSeedVendors')::integer, -1) <> 0
     or coalesce((second_import->>'insertedPositions')::integer, -1) <> 0
     or coalesce((second_import->>'insertedRounds')::integer, -1) <> 0 then
    raise exception 'Re-import was not idempotent: %', second_import;
  end if;

  perform public.manager_save_store_positions(
    'renault-barao',
    (store_configurations->'renault-barao')
  );
  if (
    select count(*) from public.prize_positions where store_id = 'renault-barao'
  ) <> 40 then
    raise exception 'Manager wheel save did not preserve the 40-position constraint';
  end if;

  select id into active_seller_id
  from public.vendors
  where store_id = 'renault-barao' and active
  order by id
  limit 1;
  if active_seller_id is null then
    raise exception 'No active seller available for spin test';
  end if;

  select count(*) into baseline_rounds from public.rounds;
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    perform public.record_public_spin(
      'renault-barao', active_seller_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
    );
    raise exception 'A non-service role unexpectedly recorded a spin';
  exception when others then
    if sqlerrm = 'A non-service role unexpectedly recorded a spin' then
      raise;
    end if;
    if sqlerrm not like '%Service role required%' then
      raise;
    end if;
  end;
  if (select count(*) from public.rounds) <> baseline_rounds then
    raise exception 'Rejected spin attempt changed the rounds table';
  end if;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  if not public.consume_spin_rate_limit(repeat('a', 64)) then
    raise exception 'Service-role rate-limit function failed its first request';
  end if;
  spin_result := public.record_public_spin(
    'renault-barao', active_seller_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
  );
  if (spin_result->>'positionIndex')::integer not between 0 and 39
     or jsonb_array_length(spin_result->'positions') <> 40
     or spin_result->'positions'->(spin_result->>'positionIndex')::integer->>'id'
        <> spin_result->>'prizeId'
     or spin_result->'positions'->(spin_result->>'positionIndex')::integer->>'name'
        <> spin_result->>'prizeName'
     or (select count(*) from public.rounds) <> baseline_rounds + 1 then
    raise exception 'Service-role spin was not atomically recorded with a 40-position snapshot';
  end if;

  repeated_spin_result := public.record_public_spin(
    'renault-barao', active_seller_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
  );
  if repeated_spin_result->>'roundId' <> spin_result->>'roundId'
     or (select count(*) from public.rounds) <> baseline_rounds + 1 then
    raise exception 'Spin idempotency did not return the existing round';
  end if;
end;
$$;

rollback;
