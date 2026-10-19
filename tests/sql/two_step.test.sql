-- =============================================================================
-- Two-step sign-in (0080, round twenty-three): the owner turns it on; a
-- session that has given only the password is refused by the database
-- itself, and one that has given the code too is let in. Everyone else is as
-- before.
-- =============================================================================
select test.golden_catalogue();
create function pg_temp.claims(p_email text, p_aal text) returns void language plpgsql as $$
begin
  perform test.act_as(p_email);
  perform set_config('request.jwt.claims',
    (current_setting('request.jwt.claims')::jsonb || jsonb_build_object('aal', p_aal))::text, false);
end $$;

-- ------------------------------------------------------------ before: as it was
select pg_temp.claims('owner@example.com', 'aal1');
select test.succeeds($$select report_daily_sales(current_date, current_date)$$,
  'with no second step, the password is enough, as before');
select test.ok((select count(*) from product) > 0, 'and the tables show what they did');

-- ------------------------------------------------------------ turned on
select test.as_admin();
insert into auth.mfa_factors (user_id, factor_type, status)
select id, 'totp', 'verified' from auth.users where email = 'owner@example.com';

select pg_temp.claims('owner@example.com', 'aal1');
select test.throws($$select report_daily_sales(current_date, current_date)$$,
  '%Finish signing in%', 'the password alone: the database refuses the owner''s session');
select test.eq((select count(*) from product), 0::bigint, 'and its rules show no table''s rows');
select test.eq(current_has_permission('settings.manage'), false, 'no permission holds');

select pg_temp.claims('owner@example.com', 'aal2');
select test.succeeds($$select report_daily_sales(current_date, current_date)$$,
  'the code given too: let in');
select test.ok((select count(*) from product) > 0, 'and the tables show again');

-- ------------------------------------------------------------ others as before
select pg_temp.claims('cashier@example.com', 'aal1');
select test.succeeds($$select record_sale(gen_random_uuid(), 'dine_in', 'card',
  '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 1}]')$$,
  'a cashier with no second step sells as before');

-- ------------------------------------------------------------ a step begun, not finished
select test.as_admin();
update auth.mfa_factors set status = 'unverified';
select pg_temp.claims('owner@example.com', 'aal1');
select test.succeeds($$select report_daily_sales(current_date, current_date)$$,
  'a second step begun but never confirmed does not lock them out');
