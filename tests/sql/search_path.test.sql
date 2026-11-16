-- =============================================================================
-- A fixed search_path for every function (0122), and citext out of the public
-- schema (0123). Both end a warning of Supabase's security advisor; neither
-- changes what anything answers.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();

-- ------------------------------------------------------------------ every function
select test.eq((select string_agg(p.oid::regprocedure::text, ', ' order by 1)
                  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.prokind in ('f', 'p')
                   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
                   and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  null::text, 'every function has a fixed search_path: a new one must be given one too');
select test.eq((select string_agg(p.oid::regprocedure::text, ', ' order by 1)
                  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.prokind in ('f', 'p')
                   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
                   and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c
                                    where c ~ '^search_path=("?\$user"?, )?public(, (extensions|auth))?$')),
  null::text, 'and each looks only in public, with extensions or auth after it');

-- ------------------------------------------------------------------ the helpers answer as before
select test.eq(money_round('00000000-0000-0000-0000-0000000000b1', 1234.5), 1234::numeric, 'money is rounded to the dinar, a tie to the even one');
select test.eq(money_round('00000000-0000-0000-0000-0000000000b1', 1235.5), 1236::numeric, 'up as well as down');
select test.eq(round_half_even(2.345, 2), 2.34, 'and to two places the same way');
select test.eq(tender_account('card'), '1010', 'card takings clear through 1010');
select test.eq(tender_account('cash'), '1000', 'cash is the till');
select test.eq(payment_account('safe'), '1005', 'the safe is 1005');
select test.eq(payment_account('Bank'), '1020', 'the bank is 1020, however it is written');
select test.eq(clock_window('2026-11-16 10:00:29+00'), clock_window('2026-11-16 10:00:01+00'), 'a clock code lasts its thirty seconds');
select test.ok(clock_window('2026-11-16 10:00:31+00') > clock_window('2026-11-16 10:00:29+00'), 'and then changes');
select test.eq(business_local_date('00000000-0000-0000-0000-0000000000b1', '2026-11-16 22:30:00+00'), date '2026-11-17',
  'the café''s day is its own: half past ten at night in London is tomorrow in Sulaymaniyah');
select test.eq(phone_order_phone('0770 123 4567'), '+9647701234567', 'a phone number is kept one way');
select test.eq(practice_task_part('kitchen_send'), 'kitchen', 'a practice task knows its part');
select test.eq((select count(*)::int from practice_task_list()), 22, 'the practice tasks are all listed');
select test.ok(not practicing(), 'nobody is practising here');
select test.ok(default_location('00000000-0000-0000-0000-0000000000b1') is not null, 'the café has its first place');
select test.ok(not period_is_locked(gen_random_uuid()), 'a month that does not exist is not locked');

-- ------------------------------------------------------------------ citext, and emails as before
select test.eq((select n.nspname::text from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'citext'),
  'extensions', 'citext lives with the other add-ons');
select test.eq((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')),
  0, 'and no add-on''s function sits among the system''s own');
select test.eq((select format_type(a.atttypid, null) from pg_attribute a
                 where a.attrelid = 'app_user'::regclass and a.attname = 'email'),
  'extensions.citext', 'a member''s email keeps its type');
select test.act_as('owner@example.com');
select invite_member('Mixed.Case@Example.com', 'Mixed Case', '{cashier}');
select test.throws($$select invite_member('mixed.case@EXAMPLE.com', 'The Same Person', '{cashier}')$$,
  '%already a member%', 'the same email in other letters is the same person');
select test.eq((select m ->> 'email' from jsonb_array_elements(to_jsonb(array(select to_jsonb(l) from list_members() l))) m
                 where m ->> 'full_name' = 'Mixed Case'),
  'mixed.case@example.com', 'kept in small letters');
select test.as_admin();
insert into auth.users (id, email, email_confirmed_at) values ('a0000000-0000-0000-0000-0000000000e1', 'MIXED.CASE@example.com', now());
select test.eq((select auth_user_id from app_user where full_name = 'Mixed Case'), 'a0000000-0000-0000-0000-0000000000e1'::uuid,
  'and a login in capital letters is still theirs');
