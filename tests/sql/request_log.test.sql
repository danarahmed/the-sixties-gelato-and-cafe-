-- =============================================================================
-- Every write recorded once (0035, release J). The app sends a key with every
-- write; a retry after a lost answer sends the same key and gets the first
-- answer back, marked "replayed", with nothing recorded twice. A key cannot be
-- reused for other details, another operation or by another person, and a
-- refused call leaves its key free. The browser suite (resend) loses the
-- answer for real; here each operation is simply sent twice. Since 0036 a
-- keyed write called through the API without its key is refused.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table sup as
  select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' order by name limit 1;
grant select on sup to public;
create function pg_temp.k(p_n int) returns uuid language sql immutable as $$
  select ('e0000000-0000-0000-0000-' || lpad(p_n::text, 12, '0'))::uuid
$$;
create function pg_temp.sell(p_tender text default 'cash') returns jsonb language sql as $$
  select record_sale(gen_random_uuid(), 'dine_in', p_tender::tender_type,
    jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', 1)))
$$;

-- ------------------------------------------------------------------ the shape
-- Every write that changes money, stock or a document: one function under its
-- own name, the key its last parameter, the work in <name>__run, which no one
-- signed in can call.
create temp table keyed (name text primary key);
insert into keyed values
  ('add_delivery_platform'), ('add_item_unit'), ('adjust_stock'), ('allocate_credit'), ('approve_po'),
  ('approve_stock_count'), ('cancel_bill'), ('cancel_po'), ('close_po'), ('note_supplier_credit'),
  ('record_supplier_credit'), ('return_to_supplier'), ('save_po'), ('send_po'),
  ('cancel_card_settlement'), ('cancel_platform_settlement'), ('cancel_production'), ('cancel_scheduled_price'),
  ('cancel_scheduled_recipe'), ('cancel_stock_count'), ('cancel_tab'), ('change_product_recipe'),
  ('copy_platform_setup'), ('create_item'), ('create_product'), ('create_supplier'),
  ('discard_journal'), ('exchange_dollars'), ('invite_member'), ('lock_period'), ('mark_bill_printed'), ('move_cash'), ('open_tab'),
  ('pay_bill'), ('post_control_correction'), ('post_legacy_unposted'), ('post_platform_settlement'),
  ('publish_journal'), ('receive_goods'), ('record_bill'), ('record_card_settlement'), ('record_expense'),
  ('record_opening_stock'), ('record_production'), ('record_waste'), ('refund_sale'), ('reject_stock_count'),
  ('reverse_journal'), ('save_batch_recipe'), ('save_category'), ('save_journal'), ('save_tab'), ('save_table'),
  ('set_fx_rate'), ('set_price'), ('split_tab'), ('start_stock_count'), ('submit_stock_count'), ('unlock_period'), ('void_sale');
grant select on keyed to public;
select test.eq((select count(*) from keyed)::int, 60,
  'sixty-one kinds of write are keyed: sixty open, the old drawer count closed since 0037');
select test.eq((select string_agg(p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname in ('count_drawer', 'count_drawer__run')
                   and (has_function_privilege('authenticated', p.oid, 'execute')
                        or has_function_privilege('anon', p.oid, 'execute'))), null,
  'the old drawer count cannot be called');
create temp table shape as
select k.name,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = k.name) as versions,
       (select p.proargnames[array_length(p.proargnames, 1)] = 'p_idempotency_key' and p.pronargdefaults > 0
               and p.prosrc like '%idem_begin(v_business, p_idempotency_key, ''' || k.name || '''%'
               and p.prosrc like '%idem_finish(v_business, p_idempotency_key, ''' || k.name || '''%'
               and p.prosrc like '%' || k.name || '__run(%'
               and has_function_privilege('authenticated', p.oid, 'execute')
               and not has_function_privilege('anon', p.oid, 'execute')
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = k.name) as keyed_ok,
       (select bool_and(not has_function_privilege('authenticated', p.oid, 'execute')
                        and not has_function_privilege('anon', p.oid, 'execute'))
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = k.name || '__run') as run_closed
  from keyed k;
grant select on shape to public;
select test.eq((select string_agg(name, ', ') from shape where versions <> 1), null,
  'each is one function under its own name: no second version to call by mistake');
select test.eq((select string_agg(name, ', ') from shape where keyed_ok is not true), null,
  'each takes the key last, checks it first and stores its answer, then does the work, open to signed-in people');
select test.eq((select string_agg(name, ', ') from shape where run_closed is not true), null,
  'the work itself cannot be called from outside the database');
-- The drawer's sessions (0036), refunds by the item (0037) and a delivery's
-- correction and reversal (0038) take their key the same way.
select test.eq((select string_agg(k.name, ', ' order by k.name)
                  from unnest(array['open_cash_session', 'close_cash_session', 'hand_over_session', 'force_close_session',
                                    'refund_sale_lines', 'correct_receipt', 'reverse_receipt']) k(name)
                 where not exists (
                   select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = k.name
                      and p.proargnames[array_length(p.proargnames, 1)] = 'p_idempotency_key' and p.pronargdefaults > 0
                      and p.prosrc like '%idem_begin(v_business, p_idempotency_key, ''' || k.name || '''%'
                      and p.prosrc like '%idem_finish(v_business, p_idempotency_key, ''' || k.name || '''%'
                      and has_function_privilege('authenticated', p.oid, 'execute')
                      and not has_function_privilege('anon', p.oid, 'execute'))), null,
  'the drawer''s sessions, refunds and corrections take their key the same way');
select test.act_as('owner@example.com');
select test.throws($$select * from request_log$$, '%permission denied%', 'the log of answers is nobody''s to read');
select test.throws($$select idem_begin(current_business_id(), gen_random_uuid(), 'x', '{}')$$, '%permission denied%',
  'nor can anyone store or look up an answer by hand');

-- ------------------------------------------------------------------ an expense, sent twice
select test.act_as('manager@example.com');
create temp table e1 as select record_expense('Ice', 1000, '6900', 'owner', null, pg_temp.k(1)) r;
create temp table e2 as select record_expense('Ice', 1000, '6900', 'owner', null, pg_temp.k(1)) r;
grant select on e1, e2 to public;
select test.as_admin();
select test.eq((select count(*) from expense where description = 'Ice')::int, 1, 'an expense sent twice is recorded once');
select test.eq((select count(*) from journal_entry where reference_type = 'expense'
                   and reference_id = (select id from expense where description = 'Ice'))::int, 1, 'with one journal');
select test.eq((select (r ->> 'replayed')::boolean from e2), true, 'the retry is told it was already recorded');
select test.eq((select r - 'replayed' from e2), (select r from e1), 'and gets the first answer: the same expense and journal');
select test.eq((select r ->> 'replayed' from e1), null, 'the first call is no replay');
select test.eq((select count(*) from audit_log where action = 'expense.record')::int, 1,
  'the expense is on the audit trail, once');
select test.eq((select after_state ->> 'description' || ', ' || (after_state ->> 'amount') || ', ' || (after_state ->> 'paid_from')
                  from audit_log where action = 'expense.record'), 'Ice, 1000, owner',
  'with what it was, how much and where the money came from');

-- The same key with other details, or for another operation, is refused.
select test.act_as('manager@example.com');
select test.throws($$select record_expense('Ice', 2000, '6900', 'owner', null, pg_temp.k(1))$$,
  '%does not match what was first sent%', 'the same key with another amount is refused');
select test.throws($$select record_waste('c0000000-0000-0000-0000-000000000001', 5, 'g', 'waste', 'spilt', null,
                                        p_idempotency_key => pg_temp.k(1))$$,
  '%does not match what was first sent%', 'and so is the same key for another operation');
-- Nor can another person replay it.
select test.act_as('owner@example.com');
select test.throws($$select record_expense('Ice', 1000, '6900', 'owner', null, pg_temp.k(1))$$,
  '%sent by someone else%', 'another person cannot use someone''s key');
-- A refused call stores nothing: the corrected retry, with the same key, is recorded.
select test.act_as('manager@example.com');
select test.throws($$select record_expense('Tea', 0, '6900', 'owner', null, pg_temp.k(2))$$,
  'Enter an amount greater than zero', 'a refused expense');
select record_expense('Tea', 1000, '6900', 'owner', null, pg_temp.k(2));
select test.as_admin();
select test.eq((select count(*) from expense where description = 'Tea')::int, 1,
  'leaves its key free: the corrected one is recorded');
-- Without a key (SQL, or an app not yet updated) a write is done as before.
select test.act_as('manager@example.com');
select record_expense('Milk run', 500, '6900', 'owner');
select record_expense('Milk run', 500, '6900', 'owner');
select test.as_admin();
select test.eq((select count(*) from expense where description = 'Milk run')::int, 2,
  'with no key, two calls are two expenses: the app always sends one');

-- ------------------------------------------------------------------ a delivery, a bill, a payment
select test.act_as('manager@example.com');
create temp table rcv as select receive_goods((select id from sup),
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":1,"unit_code":"kg","unit_price":10000}]',
  p_idempotency_key => pg_temp.k(10)) r;
create temp table rcv2 as select receive_goods((select id from sup),
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":1,"unit_code":"kg","unit_price":10000}]',
  p_idempotency_key => pg_temp.k(10)) r;
grant select on rcv, rcv2 to public;
select test.as_admin();
select test.eq((select count(*) from goods_receipt)::int, 1, 'a delivery sent twice is received once');
select test.eq((select sum(base_quantity_signed) from inventory_movement where type = 'purchase_receipt')::numeric, 1000::numeric,
  'the stock goes up once');
select test.eq((select r ->> 'receipt_id' from rcv2), (select r ->> 'receipt_id' from rcv), 'the retry names the same delivery');
select test.eq((select count(*) from audit_log where action = 'purchase.receive' and entity_id = (select r ->> 'receipt_id' from rcv))::int,
  1, 'the delivery is on the audit trail');
select test.act_as('manager@example.com');
create temp table bill as select record_bill((select id from sup), 'INV-77', test.today(), 10000, 0,
  (select (r ->> 'receipt_id')::uuid from rcv), null, pg_temp.k(11)) r;
select record_bill((select id from sup), 'INV-77', test.today(), 10000, 0,
  (select (r ->> 'receipt_id')::uuid from rcv), null, pg_temp.k(11));
grant select on bill to public;
select test.act_as('owner@example.com');
select pay_bill((select (r ->> 'bill_id')::uuid from bill), 4000, 'owner', pg_temp.k(12));
create temp table pay2 as select pay_bill((select (r ->> 'bill_id')::uuid from bill), 4000, 'owner', pg_temp.k(12)) r;
grant select on pay2 to public;
select test.as_admin();
select test.eq((select count(*) from purchase_invoice where invoice_no = 'INV-77')::int, 1, 'the bill is recorded once');
select test.eq((select paid_amount from purchase_invoice where invoice_no = 'INV-77'), 4000::numeric,
  'and paid once: 4,000, not 8,000');
select test.eq((select (r ->> 'replayed')::boolean from pay2), true, 'the second payment was a replay');
select test.eq((select count(*) from audit_log where action in ('purchase.bill', 'purchase.pay'))::int, 2,
  'the bill and its payment are on the audit trail');

-- ------------------------------------------------------------------ the drawer
-- The worst case before 0035: a count sent again compared the count with what
-- was left in the drawer, booked a false difference and moved the takings
-- again. Now the count closes the drawer's session (0036), and is keyed too.
select test.act_as('cashier@example.com');
select pg_temp.sell();
select pg_temp.sell();
select test.act_as('manager@example.com');
create temp table cnt1 as select close_cash_session(5000, null, 0, 'safe', p_idempotency_key => pg_temp.k(20)) r;
create temp table cnt2 as select close_cash_session(5000, null, 0, 'safe', p_idempotency_key => pg_temp.k(20)) r;
grant select on cnt1, cnt2 to public;
select test.as_admin();
select test.eq((select count(*) from work_shift where kind = 'session' and closed_at is not null)::int, 1,
  'a close sent twice closes once');
select test.eq((select count(*) from cash_transfer)::int, 1, 'the takings go to the safe once');
select test.eq(test.balance('1005'), 5000::numeric, 'the safe holds 5,000, not 10,000');
select test.eq((select r ->> 'variance' from cnt2), (select r ->> 'variance' from cnt1), 'the retry shows the same difference');
select test.act_as('owner@example.com');
select move_cash('safe', 'bank', 2000, 'Deposit', null, pg_temp.k(21));
select move_cash('safe', 'bank', 2000, 'Deposit', null, pg_temp.k(21));
select test.eq(test.balance('1005'), 3000::numeric, 'money moved twice is moved once');

-- ------------------------------------------------------------------ stock
select test.act_as('manager@example.com');
select record_waste('c0000000-0000-0000-0000-000000000001', 5, 'g', 'spoilage', 'spilt', null,
                    p_idempotency_key => pg_temp.k(30));
select record_waste('c0000000-0000-0000-0000-000000000001', 5, 'g', 'spoilage', 'spilt', null,
                    p_idempotency_key => pg_temp.k(30));
select adjust_stock('c0000000-0000-0000-0000-000000000002', -2, 'each', 'broken', null, null, pg_temp.k(31));
select adjust_stock('c0000000-0000-0000-0000-000000000002', -2, 'each', 'broken', null, null, pg_temp.k(31));
select test.as_admin();
select test.eq((select count(*) from inventory_movement where type = 'spoilage')::int, 1, 'a loss sent twice is one loss');
select test.eq((select count(*) from inventory_movement where type = 'manual_correction')::int, 1,
  'a correction sent twice is one correction');
select test.eq((select count(*) from audit_log where action = 'inventory.waste')::int, 1, 'the loss is on the audit trail');
-- A loss valued at nothing is recorded, with no journal (it could not be before 0035).
insert into item (id, business_id, name, item_type, base_unit_code, dimension)
values ('c0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000b1', 'Free sample sachet', 'consumable', 'each', 'count');
select test.act_as('manager@example.com');
select test.succeeds($$select record_waste('c0000000-0000-0000-0000-000000000009', 1, 'each', 'waste', 'torn')$$,
  'a loss of something never bought is recorded');
select test.as_admin();
select test.eq((select count(*) from journal_entry where reference_id =
                  (select id from inventory_movement where item_id = 'c0000000-0000-0000-0000-000000000009'))::int, 0,
  'with no journal, as it moved no value');

-- A stock count started twice is one count, and the retry names it.
select test.act_as('counter@example.com');
create temp table sc1 as select start_stock_count(null, null, pg_temp.k(32)) id;
create temp table sc2 as select start_stock_count(null, null, pg_temp.k(32)) id;
grant select on sc1, sc2 to public;
select test.as_admin();
select test.eq((select count(*) from stock_count)::int, 1, 'a count started twice is one count');
select test.eq((select id from sc2), (select id from sc1), 'and the retry gets its id');
select test.eq((select count(*) from audit_log where action = 'inventory.count.start')::int, 1,
  'starting a count is on the audit trail');

-- ------------------------------------------------------------------ bills at the till
select test.act_as('cashier@example.com');
create temp table tab1 as select open_tab('dine_in', null, 'Window seat', null,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]', null, null, null, null, null, pg_temp.k(40)) r;
create temp table tab2 as select open_tab('dine_in', null, 'Window seat', null,
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":2}]', null, null, null, null, null, pg_temp.k(40)) r;
grant select on tab1, tab2 to public;
select test.as_admin();
select test.eq((select count(*) from pos_tab where label = 'Window seat')::int, 1, 'a bill opened twice is one bill');
select test.eq((select r ->> 'tab_id' from tab2), (select r ->> 'tab_id' from tab1), 'the retry gets the same bill');
select test.act_as('cashier@example.com');
create temp table sv1 as select save_tab((select (r ->> 'tab_id')::uuid from tab1), (select (r ->> 'version')::int from tab1),
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":3}]', p_idempotency_key => pg_temp.k(41)) r;
create temp table sv2 as select save_tab((select (r ->> 'tab_id')::uuid from tab1), (select (r ->> 'version')::int from tab1),
  '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":3}]', p_idempotency_key => pg_temp.k(41)) r;
grant select on sv1, sv2 to public;
select test.eq((select r ->> 'version' from sv2), (select r ->> 'version' from sv1),
  'a save sent twice is saved once: the retry is not refused as "changed on another till"');
select test.eq((select version from pos_open_bills() where tab_id = (select (r ->> 'tab_id')::uuid from tab1)),
  (select (r ->> 'version')::int from sv1), 'the bill moved on one version');
select test.act_as('manager@example.com');
select cancel_tab((select (r ->> 'tab_id')::uuid from tab1), (select (r ->> 'version')::int from sv1),
  'Customer left', 'customer_left', pg_temp.k(42));
select test.succeeds(format($$select cancel_tab(%L, %s, 'Customer left', 'customer_left', %L)$$,
    (select r ->> 'tab_id' from tab1), (select r ->> 'version' from sv1), pg_temp.k(42)),
  'a cancellation sent again is not refused as already cancelled');
select test.as_admin();
select test.eq((select status from pos_tab where id = (select (r ->> 'tab_id')::uuid from tab1)), 'cancelled',
  'the bill is cancelled, once');
select test.eq((select count(*) from audit_log where action = 'bill.cancel')::int, 1, 'with one entry on the audit trail');

-- ------------------------------------------------------------------ a void and a refund
select test.act_as('cashier@example.com');
create temp table s1 as select pg_temp.sell('card') r;
create temp table s2 as select pg_temp.sell('card') r;
grant select on s1, s2 to public;
select test.act_as('manager@example.com');
select void_sale((select (r ->> 'order_id')::uuid from s1), 'Rang twice', 'rang_twice', null, pg_temp.k(50));
create temp table v2 as select void_sale((select (r ->> 'order_id')::uuid from s1), 'Rang twice', 'rang_twice', null, pg_temp.k(50)) r;
select refund_sale((select (r ->> 'order_id')::uuid from s2), 'Did not like it', 'changed_mind', null, pg_temp.k(51));
create temp table rf2 as select refund_sale((select (r ->> 'order_id')::uuid from s2), 'Did not like it', 'changed_mind', null, pg_temp.k(51)) r;
grant select on v2, rf2 to public;
select test.as_admin();
select test.eq((select (r ->> 'replayed')::boolean from v2) and (select (r ->> 'replayed')::boolean from rf2), true,
  'a void or a refund sent again is answered, not refused as already done');
select test.eq((select count(*) from sale_adjustment)::int, 2, 'one void and one refund');
select test.eq((select count(*) from journal_entry where reference_type = 'sale_refund')::int, 1, 'the refund is journaled once');

-- ------------------------------------------------------------------ the books and the menu
select test.act_as('owner@example.com');
select save_journal(test.today(), 'Owner loan', '[{"code":"1020","debit":100000},{"code":"3000","credit":100000}]', true,
  null, null, pg_temp.k(60));
select save_journal(test.today(), 'Owner loan', '[{"code":"1020","debit":100000},{"code":"3000","credit":100000}]', true,
  null, null, pg_temp.k(60));
create temp table su1 as select create_supplier('Fresh Farm', null, null, pg_temp.k(61)) id;
create temp table su2 as select create_supplier('Fresh Farm', null, null, pg_temp.k(61)) id;
select set_price('d1000000-0000-0000-0000-000000000001', 'takeaway', 2750, test.today() + 1, pg_temp.k(62));
select set_price('d1000000-0000-0000-0000-000000000001', 'takeaway', 2750, test.today() + 1, pg_temp.k(62));
grant select on su1, su2 to public;
select test.as_admin();
select test.eq((select count(*) from journal_entry where description = 'Owner loan')::int, 1, 'a journal sent twice is one journal');
select test.eq((select count(*) from audit_log where action = 'journal.save')::int, 1, 'saving it is on the audit trail');
select test.eq((select id from su2), (select id from su1), 'a supplier added twice is one supplier, and the retry names it');
select test.eq((select count(*) from channel_price where price = 2750)::int, 1, 'a price set twice is one price');

-- ------------------------------------------------------------------ keys required from the API (0036)
-- PostgREST names the function it serves in request.path. Through it, a keyed
-- write with no key is refused; a write's own inner calls, and SQL, are not.
select test.act_as('owner@example.com');
select set_config('request.path', '/rpc/record_expense', false);
select test.throws($$select record_expense('Gas', 1000, '6200', 'owner')$$,
  'This screen sent no retry key: reload the page and try again', 'through the API, a keyed write without its key is refused');
select test.succeeds($$select record_expense('Gas', 1000, '6200', 'owner', null, gen_random_uuid())$$,
  'with its key it goes through');
select set_config('request.path', '/rpc/open_tab', false);
select test.succeeds($$select open_tab('dine_in', null, 'Corner seat', null,
    '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]', null, null, null, null, null, gen_random_uuid())$$,
  'a bill opened with its lines: open_tab''s own save_tab needs no key of its own');
select set_config('request.path', '', false);
select test.succeeds($$select record_expense('Gas', 500, '6200', 'owner')$$, 'from SQL, without a key, it runs as before');
select test.as_admin();
select test.eq((select count(*) from expense where description = 'Gas')::int, 2, 'two gas bills: the one refused left nothing');

-- ------------------------------------------------------------------ nothing left over
select test.act_as('manager@example.com');
select test.eq((select string_agg(check_key || '=' || difference, ', ' order by check_key)
                  from report_reconciliation(test.today()) where difference <> 0), null,
  'every subledger still agrees with its account');
select test.as_admin();
select test.eq((select count(*) from request_log)::int, 20, 'one stored answer for each first call with a key');
