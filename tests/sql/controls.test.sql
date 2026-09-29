-- =============================================================================
-- Access control (audit C-01, H-06): what the public, a cashier, a counter, a
-- manager and a deactivated employee can and cannot do — and a structural
-- guard that fails if any future migration exposes a function by accident.
-- =============================================================================
select test.golden_catalogue();

-- ------------------------------------------------------------------ the public
-- Anyone holding the anon key (it is published in every page) gets nothing.
select test.act_as_anon();
select test.throws($$select count(*) from business$$, '%permission denied%', 'anon cannot read the business');
select test.throws($$select count(*) from inventory_movement$$, '%permission denied%', 'anon cannot read costs');
select test.throws($$select count(*) from journal_entry$$, '%permission denied%', 'anon cannot read the ledger');
select test.throws($$insert into journal_entry (business_id, description) values ('00000000-0000-0000-0000-0000000000b1', 'x')$$,
  '%permission denied%', 'anon cannot write a journal (C-01)');
select test.throws($$update accounting_period set status = 'open'$$, '%permission denied%', 'anon cannot unlock a period (C-01)');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash', '[]')$$, '%permission denied%',
  'anon cannot even call the sale function');
select test.throws($$select audit_event('00000000-0000-0000-0000-0000000000b1', 'forged', 'x', 'x')$$, '%permission denied%',
  'anon cannot forge the audit trail');

-- ------------------------------------------------------------------ a cashier
select test.act_as('cashier@example.com');
select test.ok((select count(*) from product_variant) > 0, 'a cashier can read the menu');
select test.ok((select count(*) from channel_price) > 0, 'and its prices');
select test.eq((select count(*) from journal_entry)::int, 0, 'but not the ledger');
select test.eq((select count(*) from inventory_movement)::int, 0, 'nor what anything cost');
select test.eq((select count(*) from supplier)::int, 0, 'nor who the suppliers are');
select test.throws($$select pin_hash from app_user$$, '%permission denied%', 'nobody reads PIN hashes');
select test.throws($$select email from app_user$$, '%permission denied%', 'nor colleagues'' email addresses');
select test.ok((select count(*) from app_user where full_name is not null) > 0, 'but colleagues'' names are visible');

-- Signed-in people write only through the permission-checked functions.
select test.throws($$insert into journal_entry (business_id, description) values ('00000000-0000-0000-0000-0000000000b1', 'x')$$,
  '%permission denied%', 'no direct journal insert, even signed in');
select test.throws($$delete from journal_line$$, '%permission denied%', 'no direct delete');
select test.throws($$update sales_order set status = 'voided'$$, '%permission denied%', 'no direct update of a sale');
select test.throws($$insert into user_role (app_user_id, role) select id, 'owner' from app_user where email = 'cashier@example.com'$$,
  '%permission denied%', 'a cashier cannot make themselves owner');
select test.throws($$select post_journal('00000000-0000-0000-0000-0000000000b1', now(), 'x', null, null, '[]')$$,
  '%permission denied%', 'the journal builder is not callable from outside');
select test.throws($$select next_document_no('00000000-0000-0000-0000-0000000000b1', 'journal')$$,
  '%permission denied%', 'nor the numbering counter');

-- ------------------------------------------------------------------ blind count
select test.act_as('counter@example.com');
select test.throws($$select expected_base from stock_count_line$$, '%permission denied%',
  'the expected quantity of a count is never readable directly');

-- ------------------------------------------------------------------ tenancy (H-06)
select test.as_admin();
do $$ declare e uuid := gen_random_uuid(); a uuid; begin
  select id into a from gl_account where business_id = '00000000-0000-0000-0000-0000000000b2' and code = '1000';
  insert into journal_entry (id, business_id, description) values (e, '00000000-0000-0000-0000-0000000000b2', 'Other café secret');
  insert into journal_line (journal_entry_id, account_id, debit, credit) values (e, a, 777, 0), (e, a, 0, 777);
end $$;
select test.act_as('manager@example.com');
select test.ok((select count(*) from journal_line) > 0, 'a manager reads their own ledger');
select test.eq((select count(*) from journal_line where debit = 777 or credit = 777)::int, 0,
  'but never another business''s journal lines (H-06)');
select test.eq((select count(*) from gl_account where business_id = '00000000-0000-0000-0000-0000000000b2')::int, 0,
  'nor its chart of accounts');

-- ------------------------------------------------------------------ deactivation
select test.as_admin();
update app_user set is_active = false where email = 'manager@example.com';
select test.act_as('manager@example.com');
select test.eq((select count(*) from journal_line)::int, 0, 'a deactivated employee reads nothing');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'cash', '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]')$$,
  '%Sign in%', 'and can do nothing');
select test.as_admin();
update app_user set is_active = true where email = 'manager@example.com';

-- ------------------------------------------------------------------ people
select test.act_as('manager@example.com');
select test.throws($$select invite_member('new@example.com', 'New', '{cashier}')$$, '%permission%', 'a manager cannot add staff');
select test.act_as('owner@example.com');
select invite_member('New.Person@Example.com', 'New Person', '{cashier}');
select test.eq((select (my_profile() ->> 'name')), 'Demo Owner', 'my_profile says who I am');
select test.ok((my_profile() -> 'permissions') ? 'accounting.period.unlock', 'and what I may do');
-- The login links only once the email is CONFIRMED: signing up with someone
-- else's address is not enough to become them.
select test.as_admin();
insert into auth.users (id, email, email_confirmed_at) values ('a0000000-0000-0000-0000-0000000000ff', 'new.person@example.com', null);
select test.eq((select auth_user_id from app_user where email = 'new.person@example.com'), null, 'an unconfirmed sign-up is not linked');
update auth.users set email_confirmed_at = now() where id = 'a0000000-0000-0000-0000-0000000000ff';
select test.eq((select auth_user_id from app_user where email = 'new.person@example.com'), 'a0000000-0000-0000-0000-0000000000ff'::uuid,
  'confirming the email links the login');
select test.act_as('new.person@example.com');
select test.ok((my_profile() -> 'roles') ? 'cashier', 'the new cashier signs in as a cashier');
-- Someone who signs up before being added is linked when they are added, so
-- "ask the owner to add you, then sign in again" works. Only if confirmed.
select test.as_admin();
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-0000000000fe', 'early@example.com');
insert into auth.users (id, email, email_confirmed_at) values ('a0000000-0000-0000-0000-0000000000fd', 'unconfirmed@example.com', null);
select test.act_as('owner@example.com');
select invite_member('Early@Example.com', 'Early Signup', '{cashier}');
select invite_member('unconfirmed@example.com', 'Unconfirmed Signup', '{cashier}');
select test.as_admin();
select test.eq((select auth_user_id from app_user where email = 'early@example.com'), 'a0000000-0000-0000-0000-0000000000fe'::uuid,
  'a login confirmed before its person was added links when they are added');
select test.eq((select auth_user_id from app_user where email = 'unconfirmed@example.com'), null,
  'an unconfirmed one does not');
select test.act_as('early@example.com');
select test.ok((my_profile() -> 'roles') ? 'cashier', 'and signs in with their role');
select test.as_admin();
create temp table owner_id as select id from app_user where email = 'owner@example.com';
grant select on owner_id to public;
select test.throws($$select set_member_active((select id from owner_id), false)$$,
  '%Sign in%', 'managing people needs a signed-in member');
select test.act_as('owner@example.com');
select test.throws($$select set_member_active((select id from owner_id), false)$$,
  '%cannot deactivate yourself%', 'the owner cannot lock themselves out');

-- Managing people: the owner sees who is who, and who has signed in.
select test.eq((select linked from list_members() where email = 'new.person@example.com'), true,
  'the member list shows the new cashier has signed in');
select test.eq((select roles::text from list_members() where email = 'new.person@example.com'), '{cashier}', 'as a cashier');
select set_member_roles((select id from list_members() where email = 'new.person@example.com'), '{cashier,barista}');
select test.eq((select roles::text from list_members() where email = 'new.person@example.com'), '{cashier,barista}',
  'roles can be changed');
select test.throws($$select set_member_roles((select id from owner_id), '{cashier}')$$,
  '%at least one active owner%', 'the last owner cannot be demoted');
select test.as_admin();
select test.eq((select count(*) from audit_log where action = 'member.roles')::int, 1, 'and every role change is audited');
select test.act_as('manager@example.com');
select test.throws($$select * from list_members()$$, '%permission%', 'a manager cannot list staff emails');

-- ------------------------------------------------------------------ structure
-- Every function a signed-in person can execute is on this list — nothing
-- more. A migration that exposes something by accident fails here.
select test.as_admin();
select test.eq((
  select string_agg(p.proname, ',' order by p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')),
  'acknowledge_alert,add_attendance,add_delivery_platform,add_item_unit,add_variant,adjust_payroll_line,'
  'adjust_points,adjust_stock,alert_thresholds,allocate_credit,app_words,approve_payroll,approve_po,'
  'approve_stock_count,attach_document,attendance_list,batch_reconciliation,buying_list,cancel_advance,'
  'cancel_attendance,'
  'cancel_bill,cancel_card_settlement,cancel_platform_settlement,cancel_po,cancel_production,'
  'cancel_salary_payment,cancel_scheduled_price,cancel_scheduled_recipe,cancel_stock_count,'
  'cancel_stock_transfer,cancel_tab,'
  'card_takings,cash_session_statement,cash_session_status,cash_sessions,change_product_recipe,'
  'clear_product_image,clock_board,clock_in,clock_out,close_cash_session,close_po,copy_platform_setup,'
  'correct_attendance,correct_receipt,create_item,create_product,create_supplier,current_alerts,'
  'current_app_user_id,current_business_id,current_can_view_costs,current_has_permission,current_has_role,'
  'customer_at_till,customer_detail,customer_list,daily_brief,dashboard_summary,detach_document,'
  'discard_journal,document_counts,document_may_attach,document_may_see,document_permissions,document_record,'
  'documents_for,'
  'draft_payroll,drawer_status,employee_advances,exchange_dollars,find_customer,force_close_session,'
  'fx_status,give_away,hand_over_session,inventory_valuation,invite_member,item_costs,item_price_history,'
  'language_settings,'
  'legacy_unposted,list_approvers,list_business_rules,list_members,lock_period,losses_waiting,'
  'mark_bill_printed,match_platform_statement,menu_branch_prices,menu_costing,menu_recipe_lines,menu_scheduled,move_cash,'
  'my_profile,next_bill_number,note_supplier_credit,open_cash_session,open_tab,pay_bill,pay_payroll,'
  'pay_salary,payroll_detail,payroll_runs,period_close_checklist,platform_money,pos_addons,pos_catalogue,'
  'pos_open_bills,post_control_correction,post_legacy_unposted,post_platform_settlement,'
  'preview_receipt_correction,production_batches,production_lots,production_plan,production_recipes,'
  'publish_journal,purchase_order,purchase_orders,purchase_orders_from_list,receive_goods,'
  'receive_stock_transfer,record_advance,'
  'record_bill,record_card_settlement,record_count,record_expense,record_loss,record_opening_stock,'
  'record_production,record_sale,record_supplier_credit,record_waste,refund_sale,refund_sale_lines,'
  'reject_stock_count,remove_item_supplier,reopen_payroll,report_balance_sheet,report_cash_flow,'
  'report_customers,report_daily_sales,'
  'report_day_totals,report_document_problems,report_dollars,report_exceptions,report_journal_lines,'
  'report_losses,report_payments,report_production,report_profit_and_loss,report_purchases,report_purchasing,'
  'report_reconciliation,report_sales_analysis,report_sizes_and_addons,report_staff,report_trial_balance,'
  'report_unclosed_days,'
  'report_uncosted_sales,report_usage_variance,request_approval,retire_variant,return_to_supplier,'
  'reverse_journal,reverse_receipt,review_loss,review_stock_count,sales_channels,save_batch_recipe,'
  'save_category,save_customer,save_customer_address,save_employee,save_journal,save_language,'
  'save_modifier,save_modifier_group,save_phrases,save_po,save_schedule,save_tab,save_table,send_po,'
  'send_stock_transfer,'
  'set_alert_thresholds,set_batch_use_by,set_business_rule,set_clock_pin,set_employee_left,'
  'set_employee_pay,set_fx_rate,set_item_supplier,set_member_active,set_member_place,set_member_roles,set_modifier_price,'
  'set_modifier_recipe,set_my_pin,set_no_stock,set_price,set_product_details,set_product_image,'
  'set_product_modifiers,settle_tab,snooze_alert,split_tab,staff_list,staff_schedule,start_stock_count,'
  'stock_card,stock_places,stock_transfers,submit_stock_count,supplier_statement,unlock_period,'
  'update_delivery_platform,update_item,'
  'update_supplier,update_variant,void_sale',
  'signed-in users can call exactly the intended API');
select test.eq((
  select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute'))::int,
  0, 'the public can call no function at all');
select test.eq((
  select string_agg(distinct p.proname, ',' order by p.proname)
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and not t.tgisinternal and not p.prosecdef
     and p.proname not in ('forbid_mutation')),
  null, 'every trigger that reads other tables runs with full visibility (security definer)');
select test.eq((select count(*) from pg_policies where schemaname = 'public' and policyname like 'demo%')::int, 0,
  'no demo policy survives');
select test.eq((select count(*) from pg_policies where schemaname = 'public' and cmd <> 'SELECT')::int, 0,
  'no policy allows anything but reading');
