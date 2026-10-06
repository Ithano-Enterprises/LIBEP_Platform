-- ADR 0001: client-generated UUIDv4 record IDs.
-- This private domain defines no catch fields or authorization policy.
create schema if not exists libep_private;
revoke all on schema libep_private from public, anon, authenticated, service_role;

create domain libep_private.client_record_id as uuid
  constraint client_record_id_v4 check (
    substring(value::text from 15 for 1) = '4'
    and substring(value::text from 20 for 1) in ('8', '9', 'a', 'b')
  );

comment on domain libep_private.client_record_id is
  'UUIDv4 syntax only. Future record columns must also enforce NOT NULL/PK and authorization.';
