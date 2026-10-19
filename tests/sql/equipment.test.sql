-- =============================================================================
-- The books completed (0081, round twenty-four): equipment and its monthly
-- depreciation, sold or thrown out; another bank, a loan, a kind of
-- equipment added on the screen.
-- =============================================================================
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create temp table b0 as select test.balance('1500') as eq, test.balance('1590') as acc, test.balance('6400') as dep,
                               test.balance('1020') as bank, test.balance('6900') as other;
grant select on b0 to public;
-- Four months ago, the first of the month: three whole months gone before this one.
create temp table d as select (date_trunc('month', test.today()) - interval '3 months')::date as start;
grant select on d to public;

-- ------------------------------------------------------------ an oven bought from the bank
select test.act_as('owner@example.com');
insert into res select 'O', add_fixed_asset('Oven', 1200000, 24, (select start from d), 0, 'bank', '1500', null,
  '81000000-0000-0000-0000-000000000001');
insert into res select 'O2', add_fixed_asset('Oven', 1200000, 24, (select start from d), 0, 'bank', '1500', null,
  '81000000-0000-0000-0000-000000000001');
select test.eq(pg_temp.r('O2') ->> 'asset_id', pg_temp.r('O') ->> 'asset_id', 'sent again: one oven');
select test.eq(test.balance('1500') - (select eq from b0), 1200000::numeric, 'the oven is in the books');
select test.eq(test.balance('1020') - (select bank from b0), -1200000::numeric, 'paid from the bank');
select test.throws($$select add_fixed_asset('Mixer', 0, 12, current_date)$$, '%what it cost%', 'it cost something');
select test.throws($$select add_fixed_asset('Mixer', 1000, 0, current_date)$$, '%1 to 600 months%',
  'it is used for some months');
select test.throws($$select add_fixed_asset('Mixer', 1000, 12, current_date, 1000)$$, '%less than what it cost%',
  'it is worth less at the end than it cost');
select test.throws($$select add_fixed_asset('Mixer', 1000, 12, current_date + 400)$$, '%up to today%',
  'it was bought already');
-- A fridge bought before, in the books already: no journal.
insert into res select 'F', add_fixed_asset('Fridge', 300000, 10, (select start from d) + 40, 50000);
select test.eq(pg_temp.r('F') ->> 'journal_no', null, 'already in the books: nothing posted');

-- ------------------------------------------------------------ depreciation for the months gone
insert into res select 'D', depreciate_to(null, '81000000-0000-0000-0000-0000000000d1');
insert into res select 'D2', depreciate_to(null, '81000000-0000-0000-0000-0000000000d1');
select test.eq((pg_temp.r('D') ->> 'months')::int, 3, 'three months posted: the oven''s three, the fridge''s two');
select test.eq((pg_temp.r('D') ->> 'amount')::numeric, 3 * 50000 + 2 * 25000::numeric,
  '50,000 a month for the oven, 25,000 for the fridge');
select test.eq(test.balance('6400') - (select dep from b0), 200000::numeric, 'a cost of depreciation');
select test.eq(test.balance('1590') - (select acc from b0), -200000::numeric, 'and the equipment worth less');
insert into res select 'D3', depreciate_to();
select test.eq((pg_temp.r('D3') ->> 'months')::int, 0, 'pressed again: nothing more, a month is posted once');
select test.eq((select (a ->> 'book_value')::numeric from jsonb_array_elements(fixed_assets() -> 'assets') a
                 where a ->> 'name' = 'Oven'), 1050000::numeric, 'the oven is worth 1,050,000 now');
select test.eq((fixed_assets() ->> 'pending_months')::int, 0, 'no month waits');

-- ------------------------------------------------------------ the fridge sold
select test.throws(format('select dispose_fixed_asset(%L, current_date, 100000)', pg_temp.r('F') ->> 'asset_id'),
  '%Say where the money went%', 'money it fetched goes somewhere');
insert into res select 'X', dispose_fixed_asset((pg_temp.r('F') ->> 'asset_id')::uuid, test.today(), 200000, 'bank');
select test.eq((pg_temp.r('X') ->> 'book_value')::numeric, 250000::numeric, 'it was worth 250,000 in the books');
select test.eq(test.balance('6900') - (select other from b0), 50000::numeric, 'sold for 200,000: a loss of 50,000');
select test.eq(test.balance('1500') - (select eq from b0), 1200000::numeric - 300000,
  'and it left the equipment');
select test.throws(format('select dispose_fixed_asset(%L, current_date)', pg_temp.r('F') ->> 'asset_id'),
  '%gone already%', 'it goes once');

-- ------------------------------------------------------------ accounts added on the screen
select create_account('1021', 'Second bank', 'bank');
select create_account('2400', 'Oven loan', 'loan');
select create_account('1510', 'Kitchen equipment', 'equipment');
select test.eq((select string_agg(code || ' ' || account_type || ' ' || normal_balance, ', ' order by code)
                  from gl_account where code in ('1021', '1510', '2400')),
  '1021 asset debit, 1510 asset debit, 2400 liability credit', 'a bank, a kind of equipment, a loan');
select test.throws($$select create_account('1100', 'Bank three', 'bank')$$, '%from 1021 to 1029%',
  'a bank in its range');
select test.throws($$select create_account('2300', 'Loan two', 'loan')$$, '%from 2400 to 2499%',
  'a loan in its range');
select test.as_admin();
select test.eq(cash_flow_line('1021') || ' ' || cash_flow_line('2400'), 'cash owner',
  'the cash flow reads a bank as cash, a loan as financing');
select test.act_as('owner@example.com');
insert into res select 'M', add_fixed_asset('Mixer', 600000, 12, test.today(), 0, '2400', '1510');
select test.eq(test.balance('2400'), -600000::numeric, 'bought with the loan: the loan owes it');
select test.act_as('cashier@example.com');
select test.throws($$select depreciate_to()$$, null, 'a cashier does not post depreciation');
select test.throws($$select fixed_assets()$$, null, 'nor reads the equipment');

select test.act_as('owner@example.com');
select test.ok((owner_money() ->> 'put_in')::numeric >= 0 and (owner_money() ->> 'taken_out')::numeric >= 0,
  'the owner''s money, all told, for the books'' readers');
