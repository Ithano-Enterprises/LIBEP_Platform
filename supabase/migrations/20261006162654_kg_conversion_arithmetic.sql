-- Read-side arithmetic for the future v_catch_kg view, not a factor-selection policy.
-- Factors must come from an accepted, evidenced conversion source.
create function libep_private.kg_from_factor(
  measured_quantity numeric,
  kg_per_unit numeric
)
returns numeric
language plpgsql
immutable
parallel safe
set search_path = pg_catalog
as $$
begin
  if measured_quantity is not null
     and measured_quantity::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = '22023', message = 'quantity must be finite';
  end if;
  if kg_per_unit is not null
     and (kg_per_unit::text in ('NaN', 'Infinity', '-Infinity') or kg_per_unit <= 0) then
    raise exception using errcode = '22023', message = 'conversion factor must be finite and positive';
  end if;
  if measured_quantity is null or kg_per_unit is null then
    return null;
  end if;
  return measured_quantity * kg_per_unit;
end;
$$;

revoke all on function libep_private.kg_from_factor(numeric, numeric)
  from public, anon, authenticated, service_role;

comment on function libep_private.kg_from_factor(numeric, numeric) is
  'Exact numeric arithmetic only; absent inputs return NULL. Does not select factors, round, persist values, authorize readers or validate catch quantities.';
