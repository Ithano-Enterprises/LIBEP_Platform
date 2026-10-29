-- Initial device model approved by backend owner; no production reference data seeded.
create table libep_private.fishers (id uuid primary key);
create table libep_private.vessels (id uuid primary key);
create table libep_private.landing_sites (id uuid primary key);
create table libep_private.species (id uuid primary key, local_name text not null);

create table libep_private.devices (
  id libep_private.client_record_id primary key,
  auth_user_id uuid not null unique references auth.users(id),
  fisher_id uuid not null references libep_private.fishers,
  vessel_id uuid not null references libep_private.vessels,
  created_at timestamptz not null default clock_timestamp()
);
-- Assignment is immutable. Reassignment/recovery must not relabel old queued data.
create table libep_private.device_events (
  sequence bigint generated always as identity primary key,
  id libep_private.client_record_id not null unique,
  device_id uuid not null references libep_private.devices,
  event_type text not null check (event_type in ('enabled', 'revoked')),
  actor_auth_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp()
);
create index device_events_current on libep_private.device_events(device_id, sequence desc);

-- No admin is seeded; an initial operator identity requires an explicit staging runbook.
create table libep_private.backend_admins (
  auth_user_id uuid primary key references auth.users(id)
);

-- Both administrative state changes and uploads lock the device row. A revocation
-- and an upload therefore have a definite order; the next upload sees revocation.
create function libep_private.lock_device_event() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  perform 1 from libep_private.devices where id = new.device_id for update;
  return new;
end;
$$;
create trigger serialize_device_event before insert on libep_private.device_events
  for each row execute function libep_private.lock_device_event();

-- Server-only administrative adapter. Its eventual caller is sync-batch, never an app RPC.
-- Account creation, reference import and initial administrator bootstrap are NOT implicit here.
create function libep_private.manage_device(
  p_admin_user_id uuid, p_event_id uuid, p_device_id uuid, p_event_type text,
  p_auth_user_id uuid default null, p_fisher_id uuid default null, p_vessel_id uuid default null
) returns void language plpgsql security definer set search_path = pg_catalog as $$
declare existing libep_private.device_events;
begin
  if not exists (select 1 from libep_private.backend_admins where auth_user_id = p_admin_user_id) then
    raise exception using errcode = '42501', message = 'administrator required';
  end if;
  if p_event_type not in ('enabled', 'revoked') or p_event_type is null then
    raise exception using errcode = '22023', message = 'invalid device event';
  end if;
  -- Serialize initial registration too. Never silently reassign an existing device.
  perform pg_advisory_xact_lock(hashtextextended(p_device_id::text, 0));
  if not exists (select 1 from libep_private.devices where id = p_device_id) then
    if p_event_type <> 'enabled' then
      raise exception using errcode = '22023', message = 'unknown device';
    end if;
    insert into libep_private.devices(id, auth_user_id, fisher_id, vessel_id)
      values (p_device_id, p_auth_user_id, p_fisher_id, p_vessel_id);
  elsif p_auth_user_id is not null or p_fisher_id is not null or p_vessel_id is not null then
    if not exists (select 1 from libep_private.devices where id = p_device_id
      and auth_user_id = p_auth_user_id and fisher_id = p_fisher_id and vessel_id = p_vessel_id) then
      raise exception using errcode = '22023', message = 'device reassignment requires recovery';
    end if;
  end if;
  perform 1 from libep_private.devices where id = p_device_id for update;
  select * into existing from libep_private.device_events where id = p_event_id;
  if found then
    if existing.device_id <> p_device_id or existing.event_type <> p_event_type
       or existing.actor_auth_user_id <> p_admin_user_id then
      raise exception using errcode = '23505', message = 'device event conflict';
    end if;
    return;
  end if;
  insert into libep_private.device_events(id, device_id, event_type, actor_auth_user_id)
    values (p_event_id, p_device_id, p_event_type, p_admin_user_id);
end;
$$;

-- Private tables have no client access. RLS also denies access absent a policy.
do $$
declare t text;
begin
  foreach t in array array['fishers','vessels','landing_sites','species','devices','device_events','backend_admins'] loop
    execute format('alter table libep_private.%I enable row level security', t);
    execute format('revoke all on libep_private.%I from public, anon, authenticated, service_role', t);
  end loop;
  foreach t in array array['devices','device_events'] loop
    execute format('create trigger immutable_rows before update or delete on libep_private.%I for each row execute function libep_private.reject_ledger_mutation()', t);
    execute format('create trigger immutable_truncate before truncate on libep_private.%I for each statement execute function libep_private.reject_ledger_mutation()', t);
  end loop;
end;
$$;
revoke all on all functions in schema libep_private from public, anon, authenticated, service_role;
revoke all on all sequences in schema libep_private from public, anon, authenticated, service_role;
