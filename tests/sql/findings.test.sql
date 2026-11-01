-- =============================================================================
-- What writing the guide found, put right (0095): a sale already agreed is
-- not held for a manager; one phone, one person; a delivery worth nothing;
-- the café's details; places added, renamed, closed; backup codes for the
-- second step; "runs out" with its unit. Golden water: 24 in stock, 1,000 each dine-in.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.on_hand(p_item uuid) returns numeric language sql security definer as $$
  select coalesce(sum(base_quantity_signed), 0) from inventory_movement where item_id = p_item
$$;
create function pg_temp.audit(p_action text) returns audit_log language sql security definer as $$
  select * from audit_log where action = p_action order by id desc limit 1
$$;
create function pg_temp.waters(n int) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000002', 'qty', n))
$$;
create function pg_temp.main() returns uuid language sql security definer as $$
  select default_location('00000000-0000-0000-0000-0000000000b1')
$$;
create function pg_temp.place(p_name text) returns uuid language sql security definer as $$
  select id from location where business_id = '00000000-0000-0000-0000-0000000000b1' and name = p_name
$$;

-- =============================================================================
-- A1. A sale already agreed is not held for a manager
-- =============================================================================
select test.act_as('owner@example.com');
select set_business_rule('negative_stock', 'item', 'c0000000-0000-0000-0000-000000000003', '"approve"', 'A manager decides');
select test.act_as('cashier@example.com');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash', pg_temp.waters(30))$$,
  'Only 24 each of Golden water is in stock: a manager approves using more than that',
  'at the till, thirty waters where the books hold 24 still wait for a manager');
insert into res select 'P', take_pre_order('Shilan', now() + interval '1 day', pg_temp.waters(30), null, null,
  'dine_in', '{"type": "cash", "amount": 5000}', null, gen_random_uuid());
insert into res select 'PS', collect_pre_order((pg_temp.r('P') ->> 'pre_order_id')::uuid, gen_random_uuid(),
  '[{"type": "cash", "amount": 25000}]');
select test.ok(pg_temp.r('PS') ->> 'order_id' is not null,
  'a pre-order of thirty collected by the cashier: no manager needed, the customer is not kept waiting');
select test.eq(pg_temp.on_hand('c0000000-0000-0000-0000-000000000003'), -6::numeric,
  'the books go below nothing, as they show for the counter to put right');
select test.eq((pg_temp.audit('stock.below_zero')).reason, 'Pre-order collected',
  'and the audit trail says it was a pre-order collected, and what');
select test.ok((pg_temp.audit('stock.below_zero')).after_state ->> 'items' like 'Golden water ×%',
  'naming the water');

select test.act_as('owner@example.com');
select save_customer(null, 'Hotel Ankawa', '0750 111 2233');
select set_customer_account((select id from customer where phone = '+9647501112233'), true, 500000, 30, 0,
  gen_random_uuid());
-- The accountant invoices (credit.manage), and approves no stock.
select test.as_admin();
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-0000000000c5', 'books@example.com');
insert into app_user (business_id, full_name, email, auth_user_id)
values ('00000000-0000-0000-0000-0000000000b1', 'Books', 'books@example.com', 'a0000000-0000-0000-0000-0000000000c5');
insert into user_role (app_user_id, role) select id, 'accountant' from app_user where email = 'books@example.com';
select test.act_as('books@example.com');
insert into res select 'I', invoice_customer((select id from customer where phone = '+9647501112233'),
  pg_temp.waters(4), gen_random_uuid(), 'Water for the rooms', 'dine_in');
select test.ok(pg_temp.r('I') ->> 'invoice_id' is not null or pg_temp.r('I') ->> 'order_id' is not null,
  'a customer invoiced for more than the books hold: no manager needed either');
select test.eq((pg_temp.audit('stock.below_zero')).reason, 'Customer invoiced', 'noted as such');

select test.act_as('owner@example.com');
select set_business_rule('negative_stock', 'item', 'c0000000-0000-0000-0000-000000000003', '"block"', 'Count the water');
select test.act_as('cashier@example.com');
insert into res select 'P2', take_pre_order('Rawa', now() + interval '1 day', pg_temp.waters(2), null, null,
  'dine_in', null, null, gen_random_uuid());
select test.throws(format('select collect_pre_order(%L, gen_random_uuid(), %L)', pg_temp.r('P2') ->> 'pre_order_id',
                          '[{"type": "cash", "amount": 2000}]'),
  'Only 0 each of Golden water is in stock: record the delivery or the batch first, or count it',
  'a rule that refuses still refuses: that is the café''s choice that nothing goes without stock');

-- =============================================================================
-- A2. One phone, one person
-- =============================================================================
select test.act_as('manager@example.com');
select save_employee(null, 'Rana', null, 'Barista', pg_temp.main(), test.today() - 30, null, gen_random_uuid());
select save_employee(null, 'Shna', null, 'Kitchen', pg_temp.main(), test.today() - 30, null, gen_random_uuid());
insert into res select 'link1', link_phone_start((select id from employee where full_name = 'Rana'));
select test.act_as_anon();
insert into res select 'phone', link_phone_finish(pg_temp.r('link1') ->> 'key');
select test.eq(pg_temp.r('phone') ->> 'replaced', null, 'Rana''s phone linked: it was nobody''s before');
select test.act_as('manager@example.com');
insert into res select 'link2', link_phone_start((select id from employee where full_name = 'Shna'));
select test.act_as_anon();
insert into res select 'phone2', link_phone_finish(pg_temp.r('link2') ->> 'key', pg_temp.r('phone') ->> 'key');
select test.eq(pg_temp.r('phone2') ->> 'replaced', 'Rana', 'the same phone linked to Shna: it says it was Rana''s');
select test.as_admin();
select test.eq((select string_agg(e.full_name, ', ' order by e.full_name) from staff_phone p
                  join employee e on e.id = p.employee_id where p.ended_at is null), 'Shna',
  'one phone, one person: Rana''s link on it ended, Shna''s stands');
select test.eq((pg_temp.audit('staff.phone_unlinked')).reason, 'The phone was linked to someone else',
  'and the audit trail says why');
select test.act_as_anon();
select test.eq(phone_status(pg_temp.r('phone') ->> 'key') ->> 'linked', 'false', 'Rana''s old key opens nothing');

-- =============================================================================
-- A3. A delivery worth nothing
-- =============================================================================
select test.act_as('manager@example.com');
insert into res select 'water_before', to_jsonb(pg_temp.on_hand('c0000000-0000-0000-0000-000000000003'));
insert into res select 'free', receive_goods((select id from supplier order by name limit 1),
  '[{"item_id": "c0000000-0000-0000-0000-000000000003", "qty": 12, "goods_value": 0}]', 0, 0, 0, 'Samples');
select test.ok(pg_temp.r('free') is not null, 'twelve waters given free are received');
select test.eq(pg_temp.on_hand('c0000000-0000-0000-0000-000000000003'),
  (pg_temp.r('water_before'))::text::numeric + 12, 'and are in stock');
select test.eq((select coalesce(sum(value), -1) from inventory_movement
                 where reference_id = (pg_temp.r('free') ->> 'receipt_id')::uuid), 0::numeric, 'at no cost');
select test.ok(not exists (select 1 from journal_entry
                            where reference_id = (pg_temp.r('free') ->> 'receipt_id')::uuid),
  'a delivery worth nothing moves nothing in the books');
select test.as_admin();
select test.ok(not exists (select 1 from document_problems('00000000-0000-0000-0000-0000000000b1', now() + interval '1 day')
                            where record_id = (pg_temp.r('free') ->> 'receipt_id')::uuid),
  'and the books'' checks do not miss its journal');
select test.act_as('owner@example.com');
select test.eq(preview_receipt_correction((pg_temp.r('free') ->> 'receipt_id')::uuid) ->> 'blocked',
  'It came free: nothing to correct. Send its goods back, or record them as a loss',
  'it has nothing to correct, and says what to do instead');
select test.act_as('manager@example.com');
select test.throws($$select receive_goods((select id from supplier order by name limit 1),
    '[{"item_id": "c0000000-0000-0000-0000-000000000003", "qty": 12, "goods_value": 0}]', 3000, 0, 0, 'Samples')$$,
  'Freight and other costs are shared by what the lines are worth: give the lines their prices',
  'freight on a delivery worth nothing has nothing to be shared by');

-- =============================================================================
-- B1. The café's details
-- =============================================================================
select test.act_as('manager@example.com');
select test.throws($$select update_business_details('Sixties')$$, 'Only the owner changes the café''s details',
  'a manager does not change them');
select test.act_as('owner@example.com');
select test.eq(business_details() ->> 'fixed', 'true', 'the café has sold: the currency and the rest are fixed');
select update_business_details('The Sixty''s Gelato & Café — Erbil', 'ckb');
select test.eq((select name || ' / ' || default_locale from business where id = '00000000-0000-0000-0000-0000000000b1'),
  'The Sixty''s Gelato & Café — Erbil / ckb', 'its name and default language change at any time');
select test.throws($$select update_business_details(null, null, 'USD')$$,
  'The currency, the time zone and bill numbers are fixed once the café has sold or posted anything',
  'the currency, once sold');
select test.throws($$select update_business_details(null, null, null, null, null, 'Asia/Dubai')$$,
  'The currency, the time zone and bill numbers are fixed once the café has sold or posted anything',
  'the time zone, once sold');
select test.throws($$select update_business_details(null, 'fr')$$, 'Choose one of the café''s languages',
  'a language the café has not');
select test.succeeds($$select update_business_details(null, null, 'IQD', null, null, 'Asia/Baghdad', 'sgc')$$,
  'the same values again are no change');
select test.eq((pg_temp.audit('settings.business_details')).after_state ->> 'name', 'The Sixty''s Gelato & Café — Erbil',
  'each change on the audit trail');

-- =============================================================================
-- B2. Places
-- =============================================================================
select test.act_as('cashier@example.com');
select test.throws($$select add_place('branch', 'Garden Branch')$$, '%settings.manage%', 'a cashier adds no place');
select test.act_as('owner@example.com');
select test.throws($$select add_place('branch', 'main branch')$$, 'There is a place called main branch already',
  'not a second Main Branch');
insert into res select 'garden', to_jsonb(add_place('branch', 'Garden Branch', 'فرع الحديقة', 'لقی باخچە',
  '95000000-0000-0000-0000-000000000001'));
insert into res select 'garden2', to_jsonb(add_place('branch', 'Garden Branch', 'فرع الحديقة', 'لقی باخچە',
  '95000000-0000-0000-0000-000000000001'));
select test.eq(pg_temp.r('garden2'), pg_temp.r('garden'), 'sent again with its key, the same place');
select test.as_admin();
select test.eq((select count(*)::int from cash_drawer where location_id = pg_temp.place('Garden Branch') and is_active),
  1, 'a new branch has its till drawer at once');
select test.act_as('owner@example.com');
select rename_place(pg_temp.place('Garden Branch'), 'Ankawa Branch', 'فرع عنكاوا', 'لقی عەنکاوە');
select test.eq((select name || ' / ' || name_ckb from location where id = (pg_temp.r('garden') #>> '{}')::uuid),
  'Ankawa Branch / لقی عەنکاوە', 'renamed, in each language');
-- It sells: a drawer opened there, a sale made there, its own place in the books.
select test.act_as('manager@example.com');
select open_cash_session(p_counted => 0, p_location => pg_temp.place('Ankawa Branch'));
insert into res select 'sold', record_sale(p_idempotency_key => gen_random_uuid(), p_channel => 'dine_in',
  p_tender => 'cash', p_lines => '[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 1}]',
  p_location => pg_temp.place('Ankawa Branch'));
select test.as_admin();
select test.eq((select location_id from sales_order where id = (pg_temp.r('sold') ->> 'order_id')::uuid),
  pg_temp.place('Ankawa Branch'), 'a sale made there is the new branch''s');
select test.act_as('owner@example.com');
select test.throws(format('select set_place_active(%L, false, %L)', pg_temp.place('Ankawa Branch'), 'Too quiet'),
  'Ankawa Branch has a drawer open: close it first', 'it does not close with a drawer open');
select test.throws(format('select set_place_active(%L, false, %L)', pg_temp.main(), 'x'), 'Say why the place closes',
  'a place closes with a reason');

-- =============================================================================
-- B5. Backup codes for the second step
-- =============================================================================
create function pg_temp.claims(p_email text, p_aal text) returns void language plpgsql as $$
begin
  perform test.act_as(p_email);
  perform set_config('request.jwt.claims',
    (current_setting('request.jwt.claims')::jsonb || jsonb_build_object('aal', p_aal))::text, false);
end $$;
select pg_temp.claims('owner@example.com', 'aal2');
select test.throws($$select make_two_step_codes()$$, 'Turn on the second step first', 'no second step: no codes');
select test.as_admin();
insert into auth.mfa_factors (user_id, factor_type, status)
select id, 'totp', 'verified' from auth.users where email = 'owner@example.com';
select pg_temp.claims('owner@example.com', 'aal1');
select test.throws($$select make_two_step_codes()$$, '%Finish signing in%', 'only a session signed in all the way');
select pg_temp.claims('owner@example.com', 'aal2');
insert into res select 'codes', to_jsonb(make_two_step_codes());
select test.eq(jsonb_array_length(pg_temp.r('codes')), 8, 'eight backup codes');
select test.ok((pg_temp.r('codes') ->> 0) ~ '^[A-Z2-9]{5}-[A-Z2-9]{5}$', 'each like ABCDE-FGH23, no 0, O, 1 or I');
select test.eq(two_step_codes_left(), 8, 'eight left');
-- The phone lost: signed in with the password only.
select pg_temp.claims('owner@example.com', 'aal1');
select test.eq(use_two_step_code('AAAAA-AAAAA') ->> 'error', 'That backup code is not right, or was used already',
  'a wrong code: no');
insert into res select 'used', use_two_step_code(lower(pg_temp.r('codes') ->> 3));
select test.eq(pg_temp.r('used') ->> 'ok', 'true', 'one of them, typed in small letters: yes');
select test.as_admin();
select test.eq((select count(*)::int from auth.mfa_factors f join auth.users u on u.id = f.user_id
                 where u.email = 'owner@example.com'), 0, 'the second step is off');
select test.eq((select count(*)::int from two_step_backup_code where used_at is null), 0, 'and the other codes with it');
select pg_temp.claims('owner@example.com', 'aal1');
select test.succeeds($$select report_daily_sales(current_date, current_date)$$,
  'the owner is in, to turn it on again with a new phone');
select test.eq((pg_temp.audit('account.two_step_off')).reason, 'A backup code was used', 'and it is on the audit trail');
-- Guessing: five wrong tries an hour.
select test.as_admin();
insert into auth.mfa_factors (user_id, factor_type, status)
select id, 'totp', 'verified' from auth.users where email = 'owner@example.com';
select pg_temp.claims('owner@example.com', 'aal1');
select use_two_step_code('BBBBB-BBBB' || n) from generate_series(1, 5) n;
select test.eq(use_two_step_code('CCCCC-CCCCC') ->> 'error', 'Too many tries: wait an hour, then try again',
  'after five wrong tries, an hour''s wait');

-- =============================================================================
-- D1. "Runs out": how much a day, with its unit
-- =============================================================================
select test.as_admin();
select test.eq(alert_qty(88.07), '88', 'ten or more: whole');
select test.eq(alert_qty(5.43), '5.4', 'under ten: to one place');
select test.eq(alert_qty(0.257), '0.26', 'under one: to two');
-- The titles themselves, with their units: tests/sql/alerts.test.sql.
