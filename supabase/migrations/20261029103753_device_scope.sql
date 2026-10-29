-- Candidate device lookup model for Ryan review; enrolment remains unimplemented.
-- No production reference data or device rows are seeded.
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

-- Private tables have no client access. RLS also denies access absent a policy.
do $$
declare t text;
begin
  foreach t in array array['fishers','vessels','landing_sites','species','devices','device_events'] loop
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
