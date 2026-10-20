-- =============================================================================
-- Each branch's books (0084, G3): the kitchen sends gelato base to the branch
-- at cost plus the owner's 10%. What was added is the kitchen's revenue and
-- the branch's cost in the profit by place, nothing in the café's own books;
-- a later change of the rule rewrites nothing; a place's own share is its
-- own. What each branch holds and owes now, and the café's apart; the
-- branches' profit and the café's add up to the café's profit.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.id(p text, f text) returns uuid language sql as $$ select (v ->> f)::uuid from res where k = p $$;

select test.act_as('owner@example.com');
select create_item('Branch gelato base', 'ingredient', 'g', 'mass', p_units => '[{"code":"kg","label":"kg","factor":1000}]',
  p_opening_qty => 10000, p_opening_unit_cost => 2, p_opening_reason => 'the opening count',
  p_location => (select id from location where name = 'Central Kitchen'));
select test.as_admin();
create temp table ids as
select (select id from item where name = 'Branch gelato base') base,
       (select id from location where name = 'Main Branch') branch,
       (select id from location where name = 'Central Kitchen') kitchen;
grant select on ids to public;
create function pg_temp.margin(p text) returns text language sql security definer as $$
  select trim_scale(markup_percent) || '% ' || trim_scale(margin) from stock_transfer where id = pg_temp.id(p, 'transfer_id')
$$;
-- An account in the profit and loss, today, at a place or the café's: "1000".
create function pg_temp.pnl(p_code text, p_place uuid) returns text language sql as $$
  select trim_scale(amount) from report_profit_and_loss(test.today(), test.today(), p_place) where code = p_code
$$;
create function pg_temp.place(p_name text) returns jsonb language sql as $$
  select x from jsonb_array_elements(branch_position() -> 'places') x where x ->> 'name' = p_name
$$;
create function pg_temp.journal_lines(p_code text) returns bigint language sql security definer as $$
  select count(*) from journal_line l join gl_account a on a.id = l.account_id where a.code = p_code
$$;

-- ------------------------------------------------------------------ the owner's share
select test.act_as('owner@example.com');
select set_business_rule('transfer_markup_percent', 'business', '', '10', 'The kitchen earns its work');
select test.throws($$select set_business_rule('transfer_markup_percent', 'business', '', '101', 'too much')$$,
  null, 'at most 100%');

-- ------------------------------------------------------------------ sent at cost, received at cost + 10%
select test.act_as('manager@example.com');
insert into res select 'T1', send_stock_transfer((select kitchen from ids), (select branch from ids),
  jsonb_build_array(jsonb_build_object('item_id', (select base from ids), 'qty', 5, 'unit_code', 'kg')),
  'For the weekend', p_idempotency_key => 'e8400000-0000-0000-0000-000000000001');
select test.act_as('owner@example.com');
select test.eq((pg_temp.place('Central Kitchen') ->> 'on_its_way')::numeric, 10000::numeric,
  'on its way: still the kitchen''s');
select test.eq((pg_temp.place('Central Kitchen') ->> 'stock')::numeric, 10000::numeric, 'and the kitchen holds the rest');
select test.eq(pg_temp.margin('T1'), '0% 0', 'nothing added before it is received');
insert into res select 'R1', receive_stock_transfer(pg_temp.id('T1', 'transfer_id'), null, 'All there',
  'e8400000-0000-0000-0000-000000000002');
select test.eq(pg_temp.margin('T1'), '10% 1000', 'received: 10% of its cost, 1,000, kept on it');
select test.eq((select x ->> 'margin' from jsonb_array_elements(stock_transfers()) x
                 where x ->> 'id' = pg_temp.id('T1', 'transfer_id')::text), '1000', 'and on the list of transfers');

-- ------------------------------------------------------------------ in the profit by place, not in the books
select test.eq(pg_temp.pnl('4950', (select kitchen from ids)), '1000', 'the kitchen sold it to the branch');
select test.eq(pg_temp.pnl('5950', (select branch from ids)), '1000', 'the branch bought it from the kitchen');
select test.eq(coalesce(pg_temp.pnl('4950', (select branch from ids)), '0') || ' '
               || coalesce(pg_temp.pnl('5950', (select kitchen from ids)), '0'), '0 0', 'each at its own place only');
select test.eq(pg_temp.pnl('4950', null) || ' ' || pg_temp.pnl('5950', null), '0 0',
  'within the café it is the same money: nothing in the café''s own profit');
select test.eq(pg_temp.journal_lines('4950') + pg_temp.journal_lines('5950'), 0::bigint, 'and no journal posted');
select test.ok(manual_journal_blocked('4950') and manual_journal_blocked('5950'), 'nor any by hand');
select test.as_admin();
select test.throws($$select post_journal('00000000-0000-0000-0000-0000000000b1', now(), 'By the back door', 'manual', null,
  jsonb_build_array(jsonb_build_object('code', '5950', 'debit', 10), jsonb_build_object('code', '1020', 'credit', 10)))$$,
  '%carry no journal%', 'nor any other way');
select test.act_as('owner@example.com');
select test.eq((select string_agg(check_key || '=' || trim_scale(difference), ', ' order by check_key)
                  from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today())
                 where check_key in ('inventory', 'transit')), 'inventory=0, transit=0', 'the books tie as before');

-- ------------------------------------------------------------------ the rule changes: nothing is rewritten
select set_business_rule('transfer_markup_percent', 'business', '', '20', 'More for the kitchen');
select test.eq(pg_temp.margin('T1'), '10% 1000', 'what was received keeps the share of its day');
-- A place's own share is its own: the kitchen sends at 5%.
select set_business_rule('transfer_markup_percent', 'location', (select kitchen from ids)::text, '5', 'The kitchen''s own');
select test.act_as('manager@example.com');
insert into res select 'T2', send_stock_transfer((select kitchen from ids), (select branch from ids),
  jsonb_build_array(jsonb_build_object('item_id', (select base from ids), 'qty', 1, 'unit_code', 'kg')),
  null, p_idempotency_key => 'e8400000-0000-0000-0000-000000000003');
select test.act_as('owner@example.com');
select receive_stock_transfer(pg_temp.id('T2', 'transfer_id'), null, null, 'e8400000-0000-0000-0000-000000000004');
select test.eq(pg_temp.margin('T2'), '5% 100', 'the kitchen''s own 5% on 2,000');
select test.eq(pg_temp.pnl('4950', (select kitchen from ids)), '1100', 'both on the kitchen''s revenue');

-- ------------------------------------------------------------------ what each branch holds and owes, now
select test.eq((pg_temp.place('Central Kitchen') ->> 'stock')::numeric, 8000::numeric, 'the kitchen holds 4 kg');
select test.eq((pg_temp.place('Main Branch') ->> 'stock')::numeric
                 - (select coalesce(sum(m.value * sign(m.base_quantity_signed)), 0) from inventory_movement m
                     where m.location_id = (select branch from ids) and m.item_id <> (select base from ids)),
  12000::numeric, 'the branch the 6 kg it received, at cost');
select test.eq((pg_temp.place('Central Kitchen') ->> 'on_its_way')::numeric, 0::numeric, 'nothing on its way now');
select test.eq((pg_temp.place('Central Kitchen') ->> 'sold_to_branches')::numeric, 13100::numeric,
  'the kitchen sold 13,100 to the branch this year, at the transfer price');
select test.eq((pg_temp.place('Main Branch') ->> 'bought_from_branches')::numeric, 13100::numeric,
  'and the branch bought as much');
select test.eq((pg_temp.place('Central Kitchen') ->> 'markup_percent')::numeric, 5::numeric, 'the kitchen''s share');
select test.eq((branch_position() -> 'cafe' ->> 'markup_percent')::numeric, 20::numeric, 'and the café''s');
select test.eq((pg_temp.place('Main Branch') ->> 'net')::numeric,
  (pg_temp.place('Main Branch') ->> 'holds')::numeric - (pg_temp.place('Main Branch') ->> 'deposits')::numeric,
  'what a branch holds less what it owes');
select test.eq((select sum((x ->> 'profit_this_year')::numeric) from jsonb_array_elements(branch_position() -> 'places') x)
               + (branch_position() -> 'cafe' ->> 'profit_this_year')::numeric,
  (select sum(case when section = 'revenue' then amount else -amount end)
     from report_profit_and_loss(date_trunc('year', test.today())::date, test.today())),
  'the branches'' profit and the café''s come to the café''s profit this year');

-- ------------------------------------------------------------------ who reads it
select test.act_as('cashier@example.com');
select test.throws($$select branch_position()$$, '%profit.view%', 'a cashier does not read it');
