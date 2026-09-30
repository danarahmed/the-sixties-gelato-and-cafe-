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
insert into res select 'E', record_expense('Fixed the grinder', 50000, '6010', 'bank', null, null, pg_temp.k(2));
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
