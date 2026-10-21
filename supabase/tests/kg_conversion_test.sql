begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(17);

-- All quantities/factors below are synthetic arithmetic fixtures, not field data.
select has_function('libep_private', 'kg_from_factor', array['numeric', 'numeric'], 'conversion helper exists');
select is(libep_private.kg_from_factor(0.1, 0.2), 0.02::numeric, 'decimal multiplication is exact');
select is(libep_private.kg_from_factor(12.345, 1), 12.345::numeric, 'identity factor preserves quantity');
select is(libep_private.kg_from_factor(1.23456789, 0.123456789), 0.15241578750190521::numeric, 'no implicit reporting rounding');
select is(libep_private.kg_from_factor(0, 2), 0::numeric, 'known zero stays zero at arithmetic layer');
select is(libep_private.kg_from_factor(10, null), null::numeric, 'missing factor is unknown, not zero');
select is(libep_private.kg_from_factor(null, 2), null::numeric, 'missing measurement is unknown');
select is(libep_private.kg_from_factor(0, null), null::numeric, 'zero measurement does not hide missing factor');
select is(libep_private.kg_from_factor(null, null), null::numeric, 'both missing stay unknown');
select throws_ok($$select libep_private.kg_from_factor(10, 0)$$, '22023', 'conversion factor must be finite and positive', 'zero factor rejected');
select throws_ok($$select libep_private.kg_from_factor(10, -1)$$, '22023', 'conversion factor must be finite and positive', 'negative factor rejected');
select throws_ok($$select libep_private.kg_from_factor(10, 'NaN')$$, '22023', 'conversion factor must be finite and positive', 'NaN factor rejected');
select throws_ok($$select libep_private.kg_from_factor(10, 'Infinity')$$, '22023', 'conversion factor must be finite and positive', 'infinite factor rejected');
select throws_ok($$select libep_private.kg_from_factor('NaN', 2)$$, '22023', 'quantity must be finite', 'NaN quantity rejected');
select throws_ok($$select libep_private.kg_from_factor('-Infinity', 2)$$, '22023', 'quantity must be finite', 'infinite quantity rejected');
select ok(not has_function_privilege('anon', 'libep_private.kg_from_factor(numeric,numeric)', 'EXECUTE'), 'anonymous callers cannot execute helper directly');
select ok(not has_function_privilege('authenticated', 'libep_private.kg_from_factor(numeric,numeric)', 'EXECUTE'), 'authenticated callers cannot execute helper directly');
select * from finish();
rollback;
