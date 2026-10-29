-- Candidate ledger subset: new correction/plant writes remain unavailable pending team policy.
create table libep_private.sync_records (
  id libep_private.client_record_id primary key,
  device_id uuid not null references libep_private.devices,
  kind text not null check (kind in ('trip_start','catch','trip_close')),
  raw_data jsonb not null,
  canonical_data jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create table libep_private.trip_starts (
  id libep_private.client_record_id primary key references libep_private.sync_records,
  device_id uuid not null references libep_private.devices,
  fisher_id uuid not null references libep_private.fishers,
  vessel_id uuid not null references libep_private.vessels,
  recorded_at timestamptz not null,
  device_clock_skew_ms bigint,
  departure_at timestamptz not null,
  crew_departed bigint not null check (crew_departed >= 1),
  created_at timestamptz not null default clock_timestamp()
);
create table libep_private.catches (
  id libep_private.client_record_id primary key references libep_private.sync_records,
  device_id uuid not null references libep_private.devices,
  trip_id uuid not null references libep_private.trip_starts,
  fisher_id uuid not null references libep_private.fishers,
  vessel_id uuid not null references libep_private.vessels,
  recorded_at timestamptz not null,
  device_clock_skew_ms bigint,
  species_id uuid references libep_private.species,
  species_local_name text not null check (length(btrim(species_local_name)) > 0),
  quantity numeric not null check (quantity > 0 and quantity = trunc(quantity) and quantity::text not in ('NaN','Infinity','-Infinity')),
  unit text not null check (unit = 'kg'),
  hold_code text check (hold_code in ('A','B','C','D')),
  latitude numeric check (latitude between -90 and 90),
  longitude numeric check (longitude between -180 and 180),
  gps_accuracy_m numeric check (gps_accuracy_m >= 0 and gps_accuracy_m::text not in ('NaN','Infinity','-Infinity')),
  zone text, season text, water_temp_c numeric, note text, short_ref text not null,
  created_at timestamptz not null default clock_timestamp(),
  check ((latitude is null) = (longitude is null))
);
create table libep_private.species_freetext (
  catch_id uuid primary key references libep_private.catches,
  original_text text not null,
  created_at timestamptz not null default clock_timestamp()
);
create table libep_private.trip_closes (
  id libep_private.client_record_id primary key references libep_private.sync_records,
  device_id uuid not null references libep_private.devices,
  trip_id uuid not null unique references libep_private.trip_starts,
  recorded_at timestamptz not null,
  device_clock_skew_ms bigint,
  arrival_at timestamptz not null,
  crew_returned bigint not null check (crew_returned >= 0),
  crew_change_reason text,
  crew_mismatch boolean not null,
  landing_site_id uuid not null references libep_private.landing_sites,
  distance_km numeric check (distance_km >= 0 and distance_km::text not in ('NaN','Infinity','-Infinity')),
  declared_total_quantity numeric not null check (declared_total_quantity >= 0),
  computed_total_quantity numeric not null check (computed_total_quantity >= 0),
  unit text not null check (unit = 'kg'),
  created_at timestamptz not null default clock_timestamp()
);
-- Membership is catches.trip_id. catch_ids is preserved only as submitted raw data.
create index catches_trip on libep_private.catches(trip_id);

create function libep_private.sync_failure(p_status integer, p_code text, p_id uuid default null, p_field text default null)
returns void language plpgsql set search_path = pg_catalog as $$
begin
  raise exception using errcode = 'P0001', message = 'sync rejected',
    detail = jsonb_build_object('status', p_status, 'code', p_code, 'record_id', p_id, 'field', p_field)::text;
end;
$$;
create function libep_private.canonical_record(p_data jsonb) returns jsonb
language plpgsql set search_path = pg_catalog as $$
declare k text; result jsonb := p_data;
begin
  for k in select jsonb_object_keys(p_data) loop
    if p_data->k = 'null'::jsonb then continue; end if;
    if k = 'id' or right(k, 3) = '_id' then
      result := jsonb_set(result, array[k], to_jsonb((p_data->>k)::uuid));
    elsif k in ('recorded_at','departure_at','arrival_at') then
      result := jsonb_set(result, array[k], to_jsonb((p_data->>k)::timestamptz at time zone 'UTC'));
    elsif k in ('quantity','total_quantity') then
      result := jsonb_set(result, array[k], to_jsonb((p_data->>k)::numeric));
    elsif k = 'catch_ids' then
      result := jsonb_set(result, array[k], (select coalesce(jsonb_agg(to_jsonb(value::uuid)), '[]') from jsonb_array_elements_text(p_data->k)));
    end if;
  end loop;
  return result;
end;
$$;

-- Private SECURITY DEFINER; exposed wrapper remains INVOKER and service-role-only.
-- p_auth_user_id comes ONLY from verified Auth /user, never client request JSON.
create function libep_private.apply_logbook_batch(p_auth_user_id uuid, p_records jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  device libep_private.devices;
  trip libep_private.trip_starts;
  saved libep_private.sync_records;
  row jsonb; data jsonb; canonical jsonb; kind text; record_id uuid;
  results jsonb := '[]'; inserted_id uuid; details text; failure jsonb;
  computed numeric; snapshot_id uuid;
begin
  select * into device from libep_private.devices where auth_user_id = p_auth_user_id for update;
  if not found then perform libep_private.sync_failure(403, 'device_unregistered'); end if;
  if (select event_type from libep_private.device_events where device_id = device.id order by sequence desc limit 1)
     is distinct from 'enabled' then
    perform libep_private.sync_failure(403, 'device_revoked');
  end if;
  if jsonb_typeof(p_records) is distinct from 'array' then
    perform libep_private.sync_failure(400, 'invalid_envelope');
  end if;
  for row in select value from jsonb_array_elements(p_records) loop
    data := row->'data'; kind := row->>'kind'; record_id := null;
    record_id := (data->>'id')::uuid;
    if record_id is null then perform libep_private.sync_failure(422, 'invalid_field', null, 'id'); end if;
    if (data->>'device_id')::uuid is distinct from device.id then
      perform libep_private.sync_failure(403, 'device_mismatch', record_id, 'device_id');
    end if;
    canonical := libep_private.canonical_record(data);
    -- Global record-ID uniqueness, including across kinds/devices. Insert races are
    -- resolved by ON CONFLICT, never a select-then-insert overwrite.
    if kind not in ('trip_start','catch','trip_close') or kind is null then
      perform libep_private.sync_failure(422, 'record_kind_not_enabled', record_id, 'kind');
    end if;
    inserted_id := null;
    insert into libep_private.sync_records(id, device_id, kind, raw_data, canonical_data)
      values(record_id, device.id, kind, data, canonical) on conflict(id) do nothing returning id into inserted_id;
    if inserted_id is null then
      select * into saved from libep_private.sync_records where id = record_id;
      if saved.device_id <> device.id then
        perform libep_private.sync_failure(403, 'record_out_of_scope', record_id);
      end if;
      if saved.kind <> kind or saved.canonical_data <> canonical then
        perform libep_private.sync_failure(409, 'id_conflict', record_id);
      end if;
      results := results || jsonb_build_array(jsonb_build_object('id', record_id, 'status', 'already_present'));
      continue;
    end if;
    if kind in ('trip_start','catch') and
       ((data->>'captain_id')::uuid is distinct from device.fisher_id or
        (data->>'vessel_id')::uuid is distinct from device.vessel_id) then
      perform libep_private.sync_failure(403, 'scope_denied', record_id);
    end if;
    if kind = 'trip_start' then
      if (data->>'trip_id')::uuid is distinct from record_id then
        perform libep_private.sync_failure(422, 'invalid_field', record_id, 'trip_id');
      end if;
      insert into libep_private.trip_starts(id,device_id,fisher_id,vessel_id,recorded_at,device_clock_skew_ms,departure_at,crew_departed)
        values(record_id,device.id,device.fisher_id,device.vessel_id,(data->>'recorded_at')::timestamptz,
          (data->>'device_clock_skew_ms')::bigint,(data->>'departure_at')::timestamptz,(data->>'crew_departed')::bigint);
    else
      select * into trip from libep_private.trip_starts where id = (data->>'trip_id')::uuid;
      if not found then perform libep_private.sync_failure(422, 'missing_dependency', record_id, 'trip_id'); end if;
      if trip.device_id <> device.id or trip.fisher_id <> device.fisher_id or trip.vessel_id <> device.vessel_id then
        perform libep_private.sync_failure(403, 'scope_denied', record_id, 'trip_id');
      end if;
      if exists (select 1 from libep_private.trip_closes where trip_id = trip.id) then
        -- No unapproved acceptance of late catches or a second close. Replays exited above.
        perform libep_private.sync_failure(409, 'trip_closed', record_id, 'trip_id');
      end if;
      if kind = 'catch' then
        insert into libep_private.catches(id,device_id,trip_id,fisher_id,vessel_id,recorded_at,device_clock_skew_ms,
          species_id,species_local_name,quantity,unit,hold_code,latitude,longitude,gps_accuracy_m,zone,season,water_temp_c,note,short_ref)
          values(record_id,device.id,trip.id,device.fisher_id,device.vessel_id,(data->>'recorded_at')::timestamptz,
            (data->>'device_clock_skew_ms')::bigint,(data->>'species_id')::uuid,data->>'species_local_name',
            (data->>'quantity')::numeric,data->>'unit',data->>'hold_code',(data->>'latitude')::numeric,
            (data->>'longitude')::numeric,(data->>'gps_accuracy_m')::numeric,data->>'zone',data->>'season',
            (data->>'water_temp_c')::numeric,data->>'note',data->>'short_ref');
        if data->>'species_id' is null then
          insert into libep_private.species_freetext(catch_id,original_text) values(record_id,data->>'species_local_name');
        end if;
      else
        -- The submitted snapshot must not reference another trip. It is not membership authority.
        for snapshot_id in select value::uuid from jsonb_array_elements_text(data->'catch_ids') loop
          if not exists(select 1 from libep_private.catches where id = snapshot_id and trip_id = trip.id) then
            perform libep_private.sync_failure(422, 'invalid_reference', record_id, 'catch_ids');
          end if;
        end loop;
        select coalesce(sum(quantity),0) into computed from libep_private.catches where trip_id = trip.id;
        insert into libep_private.trip_closes(id,device_id,trip_id,recorded_at,device_clock_skew_ms,arrival_at,
          crew_returned,crew_change_reason,crew_mismatch,landing_site_id,distance_km,declared_total_quantity,computed_total_quantity,unit)
          values(record_id,device.id,trip.id,(data->>'recorded_at')::timestamptz,(data->>'device_clock_skew_ms')::bigint,
            (data->>'arrival_at')::timestamptz,(data->>'crew_returned')::bigint,data->>'crew_change_reason',
            (data->>'crew_returned')::bigint <> trip.crew_departed,(data->>'landing_site_id')::uuid,
            (data->>'distance_km')::numeric,(data->>'total_quantity')::numeric,computed,data->>'unit');
      end if;
    end if;
    results := results || jsonb_build_array(jsonb_build_object('id', record_id, 'status', 'inserted'));
  end loop;
  return jsonb_build_object('status',200,'body',jsonb_build_object('contract_version',1,'results',results));
exception
  -- The exception subtransaction rolls back ALL inserts before constructing an error.
  when sqlstate 'P0001' then
    get stacked diagnostics details = pg_exception_detail;
    failure := details::jsonb;
    return jsonb_build_object('status',(failure->>'status')::integer,'body',jsonb_build_object('contract_version',1,
      'error',(failure - 'status') || jsonb_build_object('retryable',false)));
  when integrity_constraint_violation or data_exception then
    return jsonb_build_object('status',422,'body',jsonb_build_object('contract_version',1,
      'error',jsonb_build_object('code','invalid_record','retryable',false,'record_id',record_id,'field',null)));
end;
$$;

create function public.sync_logbook_batch(p_auth_user_id uuid, p_records jsonb)
returns jsonb language sql security invoker set search_path = pg_catalog as $$
  select libep_private.apply_logbook_batch(p_auth_user_id, p_records);
$$;
revoke all on function public.sync_logbook_batch(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.sync_logbook_batch(uuid,jsonb) to service_role;
grant usage on schema libep_private to service_role;
revoke all on all functions in schema libep_private from public, anon, authenticated, service_role;
grant execute on function libep_private.apply_logbook_batch(uuid,jsonb) to service_role;

do $$
declare t text;
begin
  foreach t in array array['sync_records','trip_starts','catches','species_freetext','trip_closes'] loop
    execute format('alter table libep_private.%I enable row level security', t);
    execute format('revoke all on libep_private.%I from public, anon, authenticated, service_role', t);
    execute format('create trigger immutable_rows before update or delete on libep_private.%I for each row execute function libep_private.reject_ledger_mutation()', t);
    execute format('create trigger immutable_truncate before truncate on libep_private.%I for each statement execute function libep_private.reject_ledger_mutation()', t);
  end loop;
end;
$$;
