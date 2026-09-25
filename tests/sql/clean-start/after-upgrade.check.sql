-- =============================================================================
-- After supabase/remediation/clean-start.sql and then the upgrade (0014 on):
-- the trial records are gone, the upgrade found no history to mark, and the
-- owner can sign in and trade from empty books that tie.
-- =============================================================================
\set biz '''00000000-0000-0000-0000-0000000000b1'''

create or replace function test.clean_act_as(p_auth uuid) returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;
grant execute on function test.clean_act_as(uuid) to public;

-- --- Kept ---------------------------------------------------------------------
select test.eq((select count(*) from business)::int, 1, 'the business is kept');
select test.eq((select count(*) from location where business_id = :biz)::int, 2, 'its locations are kept');
select test.ok((select count(*) from gl_account where business_id = :biz and code in ('1000', '1200', '2000', '4000', '5000')) = 5,
               'its chart of accounts is kept');
select test.eq((select string_agg(email::text || ':' || r.role, ',') from app_user u join user_role r on r.app_user_id = u.id),
               'owner@example.com:owner', 'the owner alone is left, with their role');

-- --- Removed, and the upgrade adds nothing back -------------------------------
do $$
declare t text; n bigint;
begin
  for t in select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
            where s.nspname = 'public' and c.relkind in ('r', 'p')
              and c.relname not in ('business', 'location', 'gl_account', 'app_user', 'user_role', 'audit_log',
                                    'role_permission', 'reason_code', 'delivery_platform')
  loop
    execute format('select count(*) from public.%I', t) into n;
    perform test.eq(n, 0::bigint, t || ' is empty');
  end loop;
end $$;
select test.eq((select count(*) from reason_code)::int, 20, 'the upgrade brings only the list of reasons (0028)');
select test.eq((select string_agg(code, ',' order by code) from delivery_platform), 'careem,talabat,toters',
  'and the delivery platforms sales are matched to (0030)');
select test.eq((select string_agg(action, ',' order by id) from audit_log), 'business.clean_start',
               'the audit trail opens with the clean start');

-- --- Go-live: the owner's real address, and their confirmed sign-up -----------
update app_user set email = 'owner@sixties.test' where email = 'owner@example.com';
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-0000000000f1', 'Owner@Sixties.test');
select test.eq((select auth_user_id from app_user), 'a0000000-0000-0000-0000-0000000000f1'::uuid,
               'a confirmed sign-up with that address signs in as the owner');
select business_local_date(:biz, now()) as today \gset

select test.clean_act_as('a0000000-0000-0000-0000-0000000000f1');
select test.eq((select count(*) from legacy_unposted())::int, 0, 'nothing is left from before the controls');

-- --- Trading from empty books -------------------------------------------------
create temp table beans as select create_item('Coffee beans', 'ingredient', 'g', 'mass',
  p_opening_qty => 1000, p_opening_unit_cost => 20, p_opening_reason => 'the opening count') r;
create temp table cups as select create_item('Takeaway cup', 'packaging', 'each', 'count',
  p_opening_qty => 100, p_opening_unit_cost => 150, p_opening_reason => 'the opening count') r;
select test.eq((select min(journal_no) from journal_entry)::int, 1001, 'the first journal is number 1001');

create temp table espresso as select create_product('Espresso', '{"dine_in": 3000, "talabat": 3500}',
  jsonb_build_array(
    jsonb_build_object('item_id', (select r ->> 'item_id' from beans), 'qty', 18, 'unit_code', 'g'),
    jsonb_build_object('item_id', (select r ->> 'item_id' from cups), 'qty', 1, 'unit_code', 'each',
                       'channels', jsonb_build_array('takeaway', 'talabat')))) r;
select test.eq((select count(*) from pos_catalogue())::int, 1, 'the till offers the new product');

create temp table cash_sale as select record_sale(gen_random_uuid(), 'dine_in', 'cash',
  jsonb_build_array(jsonb_build_object('variant_id', (select r ->> 'variant_id' from espresso), 'qty', 2))) r;
create temp table talabat_sale as select record_sale(gen_random_uuid(), 'talabat', 'platform_paid',
  jsonb_build_array(jsonb_build_object('variant_id', (select r ->> 'variant_id' from espresso), 'qty', 1)),
  p_platform_order_no => '100200') r;
select test.eq((select (r ->> 'net')::numeric from cash_sale), 6000::numeric, 'a cash sale at the dine-in price');
select test.eq((select (r ->> 'net')::numeric from talabat_sale), 3500::numeric,
               'a Talabat sale at its own price, with its order number');

select test.eq((select count(*) from report_reconciliation(:'today') where difference <> 0)::int, 0,
               'every reconciliation check is at zero');
select test.eq((select sum(debit) - sum(credit) from report_trial_balance(:'today', :'today')), 0::numeric,
               'the trial balance balances');
select test.eq((select array_agg(day) from report_unclosed_days()), array[:'today'::date], 'today is the one open day');
select count_drawer(6000);
select test.eq((select count(*) from report_unclosed_days())::int, 0, 'and once the drawer is counted, none is');

reset role;
select test.eq((select string_agg(i.name || '=' || s.qty::text, ',' order by i.name)
                  from item i
                  join lateral (select sum(base_quantity_signed) qty from inventory_movement m where m.item_id = i.id) s on true),
               'Coffee beans=946,Takeaway cup=99', 'stock is the opening balance less what was sold');
