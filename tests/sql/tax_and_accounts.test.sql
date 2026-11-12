-- =============================================================================
-- The books' blockers, first part (0102): other assets and debts the owner
-- adds; tax built in and off, then turned on at 10% (prices include it): the
-- tax part of a sale is owed, a refund gives it back, a void reverses it, and
-- the report shows each. Espresso: 2,500 dine-in.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.order_of(p text) returns uuid language sql as $$
  select (v ->> 'order_id')::uuid from res where k = p
$$;
-- What a sale's journal moved on an account, as credit less debit.
create function pg_temp.moved(p_order text, p_code text) returns numeric language sql security definer as $$
  select coalesce(sum(l.credit - l.debit), 0) from journal_line l
    join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id
   where e.reference_id = (select (v ->> 'order_id')::uuid from res where k = p_order) and g.code = p_code
$$;
create function pg_temp.unbalanced(p_order text) returns numeric language sql security definer as $$
  select sum(l.debit) - sum(l.credit) from journal_line l join journal_entry e on e.id = l.journal_entry_id
   where e.reference_id = (select (v ->> 'order_id')::uuid from res where k = p_order)
$$;
create function pg_temp.balance(p_code text) returns numeric language sql security definer as $$
  select coalesce(sum(l.credit - l.debit), 0) from journal_line l
    join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id
   where g.business_id = '00000000-0000-0000-0000-0000000000b1' and g.code = p_code and e.status = 'published'
$$;
\set E '''[{"variant_id": "d1000000-0000-0000-0000-000000000001", "qty": 2}]'''

-- ------------------------------------------------------------------ other assets and debts
select test.act_as('owner@example.com');
select test.eq(create_account('1700', 'Deposit paid to the landlord', 'asset') ->> 'type', 'asset',
  'a deposit paid: another asset');
select test.eq(create_account('2500', 'Owed to a partner', 'liability') ->> 'type', 'liability',
  'owed to a partner: another debt');
select test.throws($$select create_account('1600', 'A deposit', 'asset')$$, 'Another asset''s code is from 1700 to 1799',
  'another asset by its own codes');
select test.throws($$select create_account('2600', 'Something owed', 'liability')$$,
  'Another debt''s code is from 2500 to 2599', 'and another debt by its own');
select test.as_admin();
select test.eq((select normal_balance::text from gl_account where business_id = '00000000-0000-0000-0000-0000000000b1'
                 and code = '2500'), 'credit', 'a debt grows by its credits');

-- ------------------------------------------------------------------ tax, off
select test.act_as('owner@example.com');
select test.eq(tax_setup() ->> 'enabled', 'false', 'tax is off until the café turns it on');
select test.act_as('cashier@example.com');
insert into res select 'off', record_sale(gen_random_uuid(), 'dine_in', 'cash', :E);
select test.eq(pg_temp.moved('off', '4000'), 5000::numeric, 'off: the whole sale is income');
select test.eq(pg_temp.moved('off', '2600'), 0::numeric, 'and nothing is owed');

-- ------------------------------------------------------------------ turned on
select test.act_as('manager@example.com');
select test.throws($$select set_tax_setup(true, 'vat', 10, 'The law asks for it from this month')$$,
  '%permission%', 'a manager does not turn tax on');
select test.act_as('owner@example.com');
select test.throws($$select set_tax_setup(true, 'vat', 0, 'The law asks for it from this month')$$,
  'Tax turned on needs its rate', 'on needs its rate');
select test.throws($$select set_tax_setup(true, 'vat', 10, 'law')$$, 'Say why, in a few words', 'and why');
select test.eq(set_tax_setup(true, 'vat', 10, 'The law asks for it from this month') ->> 'account', '2600',
  'turned on: what is owed has its account');

select test.act_as('cashier@example.com');
insert into res select 'on', record_sale(gen_random_uuid(), 'dine_in', 'cash', :E);
select test.eq(pg_temp.r('on') ->> 'net', '5000', 'the customer pays the same: prices include the tax');
select test.eq(pg_temp.moved('on', '2600'), 455::numeric, '10% of 5,000 taken in is 455, owed');
select test.eq(pg_temp.moved('on', '4000'), 4545::numeric, 'and 4,545 is income');
select test.eq(pg_temp.unbalanced('on'), 0::numeric, 'the journal balances');

insert into res select 'disc', record_sale(gen_random_uuid(), 'dine_in', 'cash', :E, p_discount_percent => 10,
  p_expected_net => 4500, p_discount_reason => 'regular');
select test.eq(pg_temp.moved('disc', '2600'), 409::numeric, 'after a discount: the tax on what was paid, 409');

-- A refund gives it back; a void reverses it with the sale.
select test.act_as('manager@example.com');
insert into res select 'ref', to_jsonb(refund_sale(pg_temp.order_of('on'), 'the coffee was cold', 'quality'));
insert into res select 'void', to_jsonb(void_sale(pg_temp.order_of('disc'), null, 'rang_twice'));
select test.as_admin();
select test.eq(pg_temp.balance('2600'), 0::numeric, 'refunded and voided: nothing owed');

-- The report.
select test.act_as('cashier@example.com');
insert into res select 'kept', record_sale(gen_random_uuid(), 'dine_in', 'cash', :E);
select test.act_as('owner@example.com');
insert into res select 'rep', report_tax(test.today(), test.today());
select test.eq((pg_temp.r('rep') ->> 'collected')::numeric, (455 + 455)::numeric,
  'the report: collected on the sales kept');
select test.eq((pg_temp.r('rep') ->> 'given_back')::numeric, 455::numeric, 'given back on the refund');
select test.eq((pg_temp.r('rep') ->> 'owed')::numeric, 455::numeric, 'and owed now');

-- Off again: the next sale owes nothing; what is owed stays owed.
select set_tax_setup(false, 'vat', 10, 'Not asked for after all, this year');
select test.act_as('cashier@example.com');
insert into res select 'off2', record_sale(gen_random_uuid(), 'dine_in', 'cash', :E);
select test.eq(pg_temp.moved('off2', '2600'), 0::numeric, 'off again: nothing more owed');
select test.as_admin();
select test.eq(pg_temp.balance('2600'), 455::numeric, 'what was owed stays owed');
select test.eq((select count(*)::int from audit_log where action = 'tax.setup'), 2, 'each change on the audit trail');
