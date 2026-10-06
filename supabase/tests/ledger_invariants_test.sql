begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(16);

select has_schema('libep_private', 'private helper schema exists');
select has_type('libep_private', 'client_record_id', 'UUIDv4 domain exists');
select has_function('libep_private', 'reject_ledger_mutation', array[]::text[], 'append-only trigger function exists');
select ok(not has_schema_privilege('anon', 'libep_private', 'USAGE'), 'anonymous callers cannot access helpers');
select ok(not has_function_privilege('authenticated', 'libep_private.reject_ledger_mutation()', 'EXECUTE'), 'authenticated callers cannot execute helper directly');

-- A disposable test table, not the proposed catches schema.
create table public.libep_guard_fixture (
  id libep_private.client_record_id primary key,
  payload text not null
);
create trigger immutable_rows before update or delete on public.libep_guard_fixture
  for each row execute function libep_private.reject_ledger_mutation();
create trigger immutable_truncate before truncate on public.libep_guard_fixture
  for each statement execute function libep_private.reject_ledger_mutation();

select throws_ok(
  $$insert into public.libep_guard_fixture values ('5d9a5c8c-ec93-1bd1-8f03-5f21727e07e3', 'invalid')$$,
  '23514', null, 'non-v4 record ID rejected'
);
select throws_ok(
  $$insert into public.libep_guard_fixture values ('5d9a5c8c-ec93-4bd1-cf03-5f21727e07e3', 'invalid')$$,
  '23514', null, 'non-RFC variant rejected'
);
select lives_ok(
  $$insert into public.libep_guard_fixture values ('5d9a5c8c-ec93-4bd1-8f03-5f21727e07e3', 'original')$$,
  'UUIDv4 insertion succeeds'
);
select lives_ok(
  $$insert into public.libep_guard_fixture values ('5d9a5c8c-ec93-4bd1-8f03-5f21727e07e3', 'replacement') on conflict (id) do nothing$$,
  'conflict-safe retry succeeds'
);
select is((select payload from public.libep_guard_fixture), 'original', 'retry does not replace original');

-- Explicit DML grants make these tests prove trigger enforcement, not lack of permissions.
grant select, insert, update, delete, truncate on public.libep_guard_fixture to service_role;
set local role service_role;
select throws_ok(
  $$update public.libep_guard_fixture set payload = 'changed'$$,
  '55000', 'ledger rows are append-only', 'service-role update rejected'
);
select throws_ok(
  $$delete from public.libep_guard_fixture$$,
  '55000', 'ledger rows are append-only', 'service-role delete rejected'
);
select throws_ok(
  $$truncate public.libep_guard_fixture$$,
  '55000', 'ledger rows are append-only', 'service-role truncate rejected'
);
select lives_ok(
  $$insert into public.libep_guard_fixture values ('5d9a5c8c-ec93-4bd1-9f03-5f21727e07e3', 'second')$$,
  'service-role insert remains allowed'
);
reset role;
select is((select count(*)::integer from public.libep_guard_fixture), 2, 'only successful inserts remain');
select is((select payload from public.libep_guard_fixture where id = '5d9a5c8c-ec93-4bd1-8f03-5f21727e07e3'), 'original', 'original survives forbidden operations');
select * from finish();
rollback;
