-- =============================================================================
-- The chart of accounts on a screen (0058, the August audit's M-06): an income
-- or a cost added with its code and name, its names in Arabic and Kurdish kept
-- as the café's own words; refused for an asset, outside the income and cost
-- codes, or for a code or a name taken; posted to, and in the profit and loss;
-- renamed; taken out of use (not while a draft journal uses it), then taking no
-- expense while its past stays in the reports; brought back; the system's
-- accounts kept as they are; each change on the audit trail, and sent twice
-- with one key done once; who may; the books tie as they did.
-- =============================================================================
select test.golden_catalogue();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.k(p_n int) returns uuid language sql immutable as $$
  select ('c5800000-0000-0000-0000-' || lpad(p_n::text, 12, '0'))::uuid
$$;
-- The tests' own view, whoever they act as.
create function pg_temp.acct(p_code text) returns text language sql security definer as $$
  select name || ' ' || account_type || ' ' || normal_balance || ' ' || case when is_active then 'in use' else 'out of use' end
         || ' ' || case when is_system then 'system' else 'own' end
    from gl_account where business_id = '00000000-0000-0000-0000-0000000000b1' and code = p_code
$$;
create function pg_temp.words(p_locale text, p_phrase text) returns text language sql security definer as $$
  select words from app_phrase
   where business_id = '00000000-0000-0000-0000-0000000000b1' and locale = p_locale and phrase = p_phrase
$$;
create function pg_temp.audits(p_action text) returns int language sql security definer as $$
  select count(*)::int from audit_log where action = p_action
$$;
create function pg_temp.first_reason(p_action text) returns text language sql security definer as $$
  select reason from audit_log where action = p_action order by id limit 1
$$;
-- What the trail keeps of the first of an action: what it is about, before and after.
create function pg_temp.trail(p_action text) returns text language sql security definer as $$
  select entity_type || ' ' || entity_id || ' ' || coalesce(before_state::text, '-') || ' ' || after_state::text
    from audit_log where action = p_action order by id limit 1
$$;
create function pg_temp.checks() returns text language sql security definer as $$
  select string_agg(check_key || '=' || trim_scale(difference), ',' order by check_key)
    from reconciliation_checks('00000000-0000-0000-0000-0000000000b1', test.today())
$$;
create temp table before as select pg_temp.checks() as checks;
grant select on before to public;

-- ------------------------------------------------------------------ who may
select test.act_as('manager@example.com');
select test.throws($$select create_account('6010', 'Repairs', 'expense')$$, '%needs accounting.post%',
  'a branch manager adds no account');
select test.act_as('cashier@example.com');
select test.throws($$select create_account('6010', 'Repairs', 'expense')$$, '%needs accounting.post%',
  'nor does a cashier');

-- ------------------------------------------------------------------ an account added
select test.act_as('owner@example.com');
insert into res select 'A', create_account('6010', '  Repairs ', 'expense',
                                           '{"ar": "الإصلاحات", "ckb": "چاککردنەوە"}', pg_temp.k(1));
insert into res select 'A2', create_account('6010', '  Repairs ', 'expense',
                                            '{"ar": "الإصلاحات", "ckb": "چاککردنەوە"}', pg_temp.k(1));
select test.eq(pg_temp.r('A2') - 'replayed', pg_temp.r('A'), 'sent twice with one key: added once');
select test.eq(pg_temp.r('A2') ->> 'replayed', 'true', 'the second answered from the first');
select test.eq(pg_temp.acct('6010'), 'Repairs expense debit in use own', 'a cost, in use, the café''s own');
select test.eq(pg_temp.words('ar', 'Repairs') || ' / ' || pg_temp.words('ckb', 'Repairs'),
  'الإصلاحات / چاککردنەوە', 'its names in Arabic and Kurdish kept as the café''s own words');
select test.eq(pg_temp.audits('account.create'), 1, 'on the audit trail once');
select test.eq(pg_temp.trail('account.create'),
  'gl_account 6010 - {"name": "Repairs", "names": {"ar": "الإصلاحات", "ckb": "چاککردنەوە"}, "account_type": "expense"}',
  'the trail names it by its code, and keeps its name, its other names and its class');
insert into res select 'I', create_account('4300', 'Catering', 'revenue');
select test.eq(pg_temp.acct('4300'), 'Catering revenue credit in use own', 'an income is kept on the credit side');
select test.eq(pg_temp.words('ar', 'Catering'), null, 'a name given no other words shows as it is typed');

-- ------------------------------------------------------------------ refused
select test.throws($$select create_account('1400', 'Prepaid rent', 'asset')$$,
  'An account added here is an income or a cost%', 'an asset is added by a migration');
select test.throws($$select create_account('7000', 'Other costs', 'expense')$$, 'A cost''s code is from 5000 to 6999%',
  'a cost from 5000 to 6999');
select test.throws($$select create_account('3900', 'Tips', 'revenue')$$, 'An income''s code is from 4000 to 4999',
  'an income from 4000 to 4999');
select test.throws($$select create_account('601', 'Short', 'expense')$$, 'An account''s code is four digits',
  'a code of four digits');
select test.throws($$select create_account('6000', 'Shop rent', 'expense')$$, 'Account 6000 is Rent', 'a code taken');
select test.throws($$select create_account('6020', ' repairs. ', 'expense')$$, 'Repairs is account 6010 already',
  'a name taken, whatever its capitals, spaces and dots');
select test.throws($$select create_account('6020', '  ', 'expense')$$, 'Name the account', 'a name is needed');
select test.throws($$select create_account('6020', 'Tools', 'expense', '{"fr": "Outils"}')$$,
  '%Arabic (ar) and Kurdish (ckb)', 'its other names are in Arabic and Kurdish');
select test.eq(pg_temp.acct('6020'), null, 'nothing refused was kept');

-- ------------------------------------------------------------------ posted to
select test.act_as('manager@example.com');
insert into res select 'E', record_expense('Fixed the grinder', 50000, '6010', 'bank', p_idempotency_key => pg_temp.k(2));
select test.eq(test.lines_of((pg_temp.r('E') ->> 'expense_id')::uuid), '1020 Cr 50000 | 6010 Dr 50000',
  'an expense on it, paid from the bank');
select test.act_as('owner@example.com');
select test.eq((select section || ' ' || trim_scale(amount) from report_profit_and_loss(test.today(), test.today())
                 where code = '6010'), 'operating_expenses 50000', 'in the profit and loss, a running cost');

-- ------------------------------------------------------------------ renamed
insert into res select 'N', rename_account('6010', 'Repairs and upkeep', '{"ar": "الإصلاح والصيانة"}', pg_temp.k(3));
select test.eq(pg_temp.acct('6010'), 'Repairs and upkeep expense debit in use own', 'renamed');
select test.eq(pg_temp.words('ar', 'Repairs and upkeep'), 'الإصلاح والصيانة', 'with its new Arabic');
select test.eq(pg_temp.words('ckb', 'Repairs and upkeep'), 'چاککردنەوە', 'and its Kurdish, not given anew, kept');
select test.eq(pg_temp.words('ar', 'Repairs'), 'الإصلاحات', 'the words for its old name left as they were');
select test.eq(pg_temp.audits('account.rename'), 1, 'on the audit trail');
select test.eq(pg_temp.trail('account.rename'),
  'gl_account 6010 {"name": "Repairs"} {"name": "Repairs and upkeep", "names": {"ar": "الإصلاح والصيانة"}}',
  'its name before and after, and the other names given');
select test.throws($$select rename_account('6000', 'Shop rent')$$, 'Account 6000 Rent is one the system posts to%',
  'the system''s accounts keep their names');
select test.throws($$select rename_account('6010', 'rent')$$, 'Rent is account 6000 already', 'no name twice');
select test.throws($$select rename_account('6099', 'Something')$$, 'There is no account 6099', 'an account there is');

-- ------------------------------------------------------------------ out of use, and back
insert into res select 'D', save_journal(test.today(), 'Accrued repairs',
                                         '[{"code":"6010","debit":1000},{"code":"1020","credit":1000}]', false);
select test.throws($$select set_account_in_use('6010', false, 'Merged into Other expenses')$$,
  'A draft journal (Accrued repairs) has a line on account 6010%', 'not while a draft journal uses it');
select discard_journal((pg_temp.r('D') ->> 'id')::uuid);
select test.throws($$select set_account_in_use('6010', false, ' ')$$, 'Say why', 'with why');
select test.throws($$select set_account_in_use('1000', false, 'Not needed')$$,
  'Account 1000 % is one the system posts to%', 'the system''s accounts stay in use');
insert into res select 'O', set_account_in_use('6010', false, 'Merged into Other expenses', pg_temp.k(4));
insert into res select 'O2', set_account_in_use('6010', false, 'Merged into Other expenses', pg_temp.k(4));
select test.eq(pg_temp.r('O2') - 'replayed', pg_temp.r('O'), 'sent twice with one key: once');
select test.eq(pg_temp.acct('6010'), 'Repairs and upkeep expense debit out of use own', 'out of use');
select test.throws($$select set_account_in_use('6010', false, 'Again')$$,
  'Account 6010 Repairs and upkeep is out of use already', 'once');
select test.act_as('manager@example.com');
select test.throws($$select record_expense('Fixed the door', 20000, '6010', 'bank')$$,
  'Account 6010 cannot take an expense%', 'out of use, it takes no expense');
select test.act_as('owner@example.com');
select test.eq((select trim_scale(amount) from report_profit_and_loss(test.today(), test.today()) where code = '6010'),
  '50000', 'what was posted to it stays in the profit and loss');
insert into res select 'B', set_account_in_use('6010', true, 'Needed again');
select test.eq(pg_temp.acct('6010'), 'Repairs and upkeep expense debit in use own', 'brought back');
select test.eq(pg_temp.audits('account.in_use'), 2, 'each on the audit trail, with why');
select test.eq(pg_temp.first_reason('account.in_use'), 'Merged into Other expenses', 'the reason kept');
select test.eq(pg_temp.trail('account.in_use'),
  'gl_account 6010 {"name": "Repairs and upkeep", "is_active": true} {"name": "Repairs and upkeep", "is_active": false}',
  'in use before, out of use after, under its name');

-- ------------------------------------------------------------------ the books
select test.eq(pg_temp.checks(), (select checks from before), 'the books tie as they did');

-- ------------------------------------------------------------------ out of use, its history still posted (0062)
-- Out of use, an account takes nothing new; what was posted to it is still
-- reversed, shared out and closed at the year's end.
select test.as_admin();
create function pg_temp.year_end() returns uuid language sql security definer as $$
  select post_year_end_close('00000000-0000-0000-0000-0000000000b1',
                             make_date(extract(year from test.today())::int, 12, 31))
$$;
create function pg_temp.month(p_plus int) returns date language sql stable as $$
  select (date_trunc('month', test.today()) + make_interval(months => p_plus))::date
$$;
create function pg_temp.release_through(p_day date) returns jsonb language sql security definer as $$
  select release_prepaid__run('00000000-0000-0000-0000-0000000000b1', p_day,
                              (select id from app_user where email = 'owner@example.com'))
$$;
-- The moment 0061 cannot see: the account taken out of use as a prepaid expense is recorded on it.
create function pg_temp.out_of_use_now(p_code text) returns void language sql security definer as $$
  update gl_account set is_active = false
   where business_id = '00000000-0000-0000-0000-0000000000b1' and code = p_code
$$;
select test.act_as('owner@example.com');
insert into res select 'E3', record_expense('Fixed the fridge', 30000, '6010', 'bank',
                                            p_idempotency_key => pg_temp.k(10));
insert into res select 'P', record_prepaid_expense('Upkeep contract, two months', 40000, '6010', 'bank',
                                                   pg_temp.month(1), 2, p_idempotency_key => pg_temp.k(11));
select pg_temp.out_of_use_now('6010');
select test.eq(pg_temp.acct('6010'), 'Repairs and upkeep expense debit out of use own', 'out of use');
select test.succeeds(format($$select reverse_journal('%s', 'The fridge was under guarantee')$$,
                            (select journal_entry_id from expense
                              where id = (pg_temp.r('E3') ->> 'expense_id')::uuid)),
  'an expense on it is still reversed');
select test.throws($$select record_expense('Fixed the door', 20000, '6010', 'bank')$$,
  'Account 6010 cannot take an expense%', 'but nothing new is posted to it');
select test.throws($$select save_journal(test.today(), 'Repairs',
                                         '[{"code":"6010","debit":500},{"code":"1020","credit":500}]', true)$$,
  'Account 6010 is missing or inactive', 'nor a journal by hand');
-- The year's end closes it with the rest (locking December posts it): the
-- grinder's 50,000; the fridge's 30,000 was reversed.
insert into res select 'Y', jsonb_build_object('id', pg_temp.year_end());
select test.eq((select trim_scale(l.credit) from journal_line l join gl_account a on a.id = l.account_id
                 where l.journal_entry_id = (pg_temp.r('Y') ->> 'id')::uuid and a.code = '6010'),
               '50000', 'the year-end close takes it to retained earnings with the rest');
-- The prepaid expense recorded on it as it went out of use: its shares are posted when their months come.
insert into res select 'R', pg_temp.release_through(pg_temp.month(2));
select test.eq(jsonb_array_length(pg_temp.r('R')), 2, 'its two shares are posted to it all the same');
insert into res select 'C', cancel_prepaid_expense((pg_temp.r('P') ->> 'prepaid_id')::uuid, 'Contract ended early');
select test.eq((pg_temp.r('C') ->> 'shares_reversed')::int, 2, 'and cancelled, both shares are reversed');

-- ------------------------------------------------------------------ sales revenue by hand (0062)
-- 4000, 4100 and 4200 move only with sales and refunds: the books tie them to
-- the sales recorded. Money in that is not a sale goes to an income account.
select test.throws($$select save_journal(test.today(), 'Bank interest',
                                         '[{"code":"1020","debit":1500},{"code":"4000","credit":1500}]', true)$$,
  'Account 4000 has a subledger and cannot take a manual journal%', 'sales revenue takes no journal by hand');
select test.throws($$select save_journal(test.today(), 'A discount',
                                         '[{"code":"4100","debit":1500},{"code":"1020","credit":1500}]', true)$$,
  'Account 4100 has a subledger%', 'nor the discounts');
select test.throws($$select save_journal(test.today(), 'A refund',
                                         '[{"code":"4200","debit":1500},{"code":"1020","credit":1500}]', true)$$,
  'Account 4200 has a subledger%', 'nor the refunds');
select create_account('4310', 'Bank interest', 'revenue');
select test.succeeds($$select save_journal(test.today(), 'Bank interest',
                                           '[{"code":"1020","debit":1500},{"code":"4310","credit":1500}]', true)$$,
  'an income account the café adds takes it');
select test.eq(pg_temp.checks(), (select checks from before), 'and the books still tie');
