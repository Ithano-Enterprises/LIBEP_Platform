begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
 select ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid;
$$;
insert into auth.users(id) values(pg_temp.uid(100)),(pg_temp.uid(101)),(pg_temp.uid(102));
insert into libep_private.fishers values(pg_temp.uid(91)),(pg_temp.uid(191));
insert into libep_private.vessels values(pg_temp.uid(92)),(pg_temp.uid(192));
insert into libep_private.landing_sites values(pg_temp.uid(93));
-- Synthetic test provisioning only. No enrolment API or real device provisioning.
insert into libep_private.devices(id,auth_user_id,fisher_id,vessel_id) values
 (pg_temp.uid(90),pg_temp.uid(101),pg_temp.uid(91),pg_temp.uid(92)),
 (pg_temp.uid(190),pg_temp.uid(102),pg_temp.uid(191),pg_temp.uid(192));
insert into libep_private.device_events(id,device_id,event_type,actor_auth_user_id) values
 (pg_temp.uid(201),pg_temp.uid(90),'enabled',pg_temp.uid(100)),
 (pg_temp.uid(202),pg_temp.uid(190),'enabled',pg_temp.uid(100));
select throws_ok($$update libep_private.devices set fisher_id=pg_temp.uid(191) where id=pg_temp.uid(90)$$,'55000','ledger rows are append-only','assignment cannot be silently changed');
create function pg_temp.batch() returns jsonb language sql as $fixture$
 select '[{"kind": "trip_start", "data": {"id": "00000000-0000-4000-8000-000000000001", "device_id": "00000000-0000-4000-8000-000000000090", "recorded_at": "2026-10-28T06:00:00.000Z", "device_clock_skew_ms": null, "trip_id": "00000000-0000-4000-8000-000000000001", "captain_id": "00000000-0000-4000-8000-000000000091", "vessel_id": "00000000-0000-4000-8000-000000000092", "crew_departed": 3, "departure_at": "2026-10-28T06:00:00.000Z"}}, {"kind": "catch", "data": {"id": "00000000-0000-4000-8000-000000000002", "device_id": "00000000-0000-4000-8000-000000000090", "recorded_at": "2026-10-28T06:00:00.000Z", "device_clock_skew_ms": null, "trip_id": "00000000-0000-4000-8000-000000000001", "captain_id": "00000000-0000-4000-8000-000000000091", "vessel_id": "00000000-0000-4000-8000-000000000092", "species_id": null, "species_local_name": " TEST ONLY \u2014 unmatched local name ", "quantity": "15", "unit": "kg", "tier": "S", "hold_code": null, "latitude": null, "longitude": null, "gps_accuracy_m": null, "zone": null, "season": null, "water_temp_c": null, "note": "TEST ONLY", "short_ref": "TEST-001"}}, {"kind": "trip_close", "data": {"id": "00000000-0000-4000-8000-000000000004", "device_id": "00000000-0000-4000-8000-000000000090", "recorded_at": "2026-10-28T06:00:00.000Z", "device_clock_skew_ms": null, "trip_id": "00000000-0000-4000-8000-000000000001", "arrival_at": "2026-10-28T06:00:00.000Z", "crew_returned": 2, "crew_change_reason": null, "landing_site_id": "00000000-0000-4000-8000-000000000093", "distance_km": null, "catch_ids": ["00000000-0000-4000-8000-000000000002"], "total_quantity": "20", "unit": "kg"}}]'::jsonb;
$fixture$;
create function pg_temp.apply(records jsonb, actor uuid default pg_temp.uid(101)) returns jsonb language sql as $$
 select public.sync_logbook_batch(actor,records);
$$;
select is((pg_temp.apply(jsonb_set(pg_temp.batch(),'{2,data,landing_site_id}',to_jsonb(pg_temp.uid(999))))->>'status')::int,422,'invalid final row fails whole batch');
select is((select count(*)::int from libep_private.sync_records),0,'failed batch leaves no receipts');
select is((select count(*)::int from libep_private.trip_starts),0,'failed batch leaves no starts');
select is((select count(*)::int from libep_private.catches),0,'failed batch leaves no catches');
select is((select count(*)::int from libep_private.species_freetext),0,'failed batch leaves no unmatched side rows');
select is((select count(*)::int from libep_private.trip_closes),0,'failed batch leaves no closes');
select is((pg_temp.apply(jsonb_build_array(pg_temp.batch()->1))->>'status')::int,422,'catch before trip is missing dependency');
select is((pg_temp.apply(pg_temp.batch(),pg_temp.uid(102))->>'status')::int,403,'different device cannot impersonate payload device');
select is((pg_temp.apply(jsonb_set(pg_temp.batch(),'{0,data,captain_id}',to_jsonb(pg_temp.uid(191)))))->>'status','403','granted device cannot name another captain');
select is((pg_temp.apply(pg_temp.batch())->>'status')::int,200,'valid batch commits');
select is((select count(*)::int from libep_private.sync_records),3,'three receipt rows committed');
select is(pg_temp.apply(pg_temp.batch())#>>'{body,results,0,status}','already_present','trip replay acknowledged');
select is(pg_temp.apply(pg_temp.batch())#>>'{body,results,1,status}','already_present','catch replay acknowledged after close');
select is(pg_temp.apply(pg_temp.batch())#>>'{body,results,2,status}','already_present','close replay acknowledged');
select is((select count(*)::int from libep_private.sync_records),3,'replay creates no duplicates');
select is((select computed_total_quantity from libep_private.trip_closes),15::numeric,'server recomputes total from catches');
select is((select declared_total_quantity from libep_private.trip_closes),20::numeric,'declared total retained separately');
select ok((select crew_mismatch from libep_private.trip_closes),'crew mismatch flagged without blocking close');
select is((select original_text from libep_private.species_freetext),pg_temp.batch()#>>'{1,data,species_local_name}','unmatched local name preserved exactly');
select is(pg_temp.apply(jsonb_set(pg_temp.batch(),'{1,data,quantity}','"16"'))#>>'{body,error,code}','id_conflict','same ID different quantity conflicts');
select is(pg_temp.apply(jsonb_set(pg_temp.batch(),'{1,data,quantity}','"16"'))#>>'{body,error,record_id}',pg_temp.uid(2)::text,'conflict names record');
select is((pg_temp.apply(jsonb_set(pg_temp.batch(),'{1,data,quantity}','"015"'))->>'status')::int,200,'equivalent decimal spelling acknowledged');
select is((pg_temp.apply(jsonb_set(pg_temp.batch(),'{0,data,recorded_at}','"2026-10-28T09:00:00+03:00"'))->>'status')::int,200,'equivalent timestamp instant acknowledged');
select is(pg_temp.apply(jsonb_set(jsonb_build_array(pg_temp.batch()->1),'{0,data,id}',to_jsonb(pg_temp.uid(5))))#>>'{body,error,code}','trip_closed','new late catch held pending policy');
select is(pg_temp.apply(jsonb_build_array(jsonb_build_object('kind','catch_correction','data',jsonb_build_object('id',pg_temp.uid(6),'device_id',pg_temp.uid(90)))))#>>'{body,error,code}','record_kind_not_enabled','unagreed correction writes fail closed');
insert into libep_private.device_events(id,device_id,event_type,actor_auth_user_id)
 values(pg_temp.uid(203),pg_temp.uid(90),'revoked',pg_temp.uid(100));
select is(pg_temp.apply(pg_temp.batch())#>>'{body,error,code}','device_revoked','revocation blocks even identical replay');
select is((select count(*)::int from libep_private.device_events),3,'revocation history retained');
select ok(not has_function_privilege('anon','public.sync_logbook_batch(uuid,jsonb)','EXECUTE'),'anonymous cannot call mutation RPC');
select ok(not has_function_privilege('authenticated','public.sync_logbook_batch(uuid,jsonb)','EXECUTE'),'authenticated apps cannot bypass Edge Function');
select ok(has_function_privilege('service_role','public.sync_logbook_batch(uuid,jsonb)','EXECUTE'),'server adapter can execute RPC');
select ok(not has_table_privilege('service_role','libep_private.catches','INSERT'),'service role has no direct table writes');
select ok(not has_table_privilege('authenticated','libep_private.catches','SELECT'),'client cannot read base ledger');
select throws_ok($$update libep_private.devices set id=id$$,'55000','ledger rows are append-only','devices: update blocked');
select throws_ok($$delete from libep_private.devices$$,'55000','ledger rows are append-only','devices: delete blocked');
select throws_ok($$truncate libep_private.devices cascade$$,'55000','ledger rows are append-only','devices: truncate blocked');
select throws_ok($$update libep_private.device_events set event_type=event_type$$,'55000','ledger rows are append-only','device_events: update blocked');
select throws_ok($$delete from libep_private.device_events$$,'55000','ledger rows are append-only','device_events: delete blocked');
select throws_ok($$truncate libep_private.device_events cascade$$,'55000','ledger rows are append-only','device_events: truncate blocked');
select throws_ok($$update libep_private.sync_records set id=id$$,'55000','ledger rows are append-only','sync_records: update blocked');
select throws_ok($$delete from libep_private.sync_records$$,'55000','ledger rows are append-only','sync_records: delete blocked');
select throws_ok($$truncate libep_private.sync_records cascade$$,'55000','ledger rows are append-only','sync_records: truncate blocked');
select throws_ok($$update libep_private.trip_starts set id=id$$,'55000','ledger rows are append-only','trip_starts: update blocked');
select throws_ok($$delete from libep_private.trip_starts$$,'55000','ledger rows are append-only','trip_starts: delete blocked');
select throws_ok($$truncate libep_private.trip_starts cascade$$,'55000','ledger rows are append-only','trip_starts: truncate blocked');
select throws_ok($$update libep_private.catches set id=id$$,'55000','ledger rows are append-only','catches: update blocked');
select throws_ok($$delete from libep_private.catches$$,'55000','ledger rows are append-only','catches: delete blocked');
select throws_ok($$truncate libep_private.catches cascade$$,'55000','ledger rows are append-only','catches: truncate blocked');
select throws_ok($$update libep_private.species_freetext set original_text=original_text$$,'55000','ledger rows are append-only','species_freetext: update blocked');
select throws_ok($$delete from libep_private.species_freetext$$,'55000','ledger rows are append-only','species_freetext: delete blocked');
select throws_ok($$truncate libep_private.species_freetext cascade$$,'55000','ledger rows are append-only','species_freetext: truncate blocked');
select throws_ok($$update libep_private.trip_closes set id=id$$,'55000','ledger rows are append-only','trip_closes: update blocked');
select throws_ok($$delete from libep_private.trip_closes$$,'55000','ledger rows are append-only','trip_closes: delete blocked');
select throws_ok($$truncate libep_private.trip_closes cascade$$,'55000','ledger rows are append-only','trip_closes: truncate blocked');
select * from finish();
rollback;
