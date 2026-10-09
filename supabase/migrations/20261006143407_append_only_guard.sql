-- ADR 0001: triggers, not RLS, enforce the append-only ledger.
-- Attach to each accepted ledger table when that table is introduced:
-- BEFORE UPDATE OR DELETE FOR EACH ROW, plus BEFORE TRUNCATE FOR EACH STATEMENT.
create function libep_private.reject_ledger_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'ledger rows are append-only';
end;
$$;

revoke all on function libep_private.reject_ledger_mutation()
  from public, anon, authenticated, service_role;

comment on function libep_private.reject_ledger_mutation() is
  'Rejects ledger UPDATE, DELETE and TRUNCATE when attached as the appropriate triggers. Inserts remain allowed.';
