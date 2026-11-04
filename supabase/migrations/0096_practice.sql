-- =============================================================================
-- 0096 — Practice: the same app, with pretend money and stock
-- =============================================================================
-- Each person may practise in a practice café of their own: the same screens,
-- their own roles, a small menu, stock and a supplier, and nothing of it in the
-- café's books. Practice is a twin of the person (practice_twin), a person of
-- the practice café; while the app says it is practising (the request header
-- x-sixties-practice: 1), every function that asks who is signed in answers
-- with the twin, so every rule that keeps one café's records from another's
-- keeps practice away from the real ones. With no twin, a practising request
-- is no one: it can do nothing, rather than act for real.
--
-- Each role has its tasks (practice_tasks): sell two lattes by card, close the
-- drawer, approve a count…, each ticked from what the person did in practice
-- and kept once ticked; a manager sees who is ready (practice_team).
--
-- Nothing recorded changes. Rehearsed with tests/sql/practice.test.sql.
-- =============================================================================

alter table business add column if not exists practice_of uuid references business(id);
comment on column business.practice_of is
  'A practice café (0096): the café whose person practises here. Null for a real café.';

create table if not exists practice_twin (
  app_user_id uuid primary key references app_user(id),
  twin_id     uuid not null unique references app_user(id),
  started_at  timestamptz not null default now()
);
create table if not exists practice_task_done (
  app_user_id uuid not null references app_user(id),
  task        text not null,
  done_at     timestamptz not null default now(),
  primary key (app_user_id, task)
);
alter table practice_twin enable row level security;
alter table practice_task_done enable row level security;
revoke all on practice_twin, practice_task_done from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 1. Who is signed in: the person, or their twin while practising
-- -----------------------------------------------------------------------------
-- Whether this request is practice: the app sends x-sixties-practice: 1.
create or replace function practicing() returns boolean
language sql stable as $$
  select coalesce(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-sixties-practice', '') = '1'
$$;

-- The person signed in, whatever the request says.
create or replace function real_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from app_user where auth_user_id = auth.uid() and is_active limit 1
$$;

-- Who this request acts as: the person, or while practising their twin (none
-- without one: practice never falls back to the real café).
create or replace function session_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select case when practicing()
              then (select t.twin_id from practice_twin t join app_user w on w.id = t.twin_id and w.is_active
                     where t.app_user_id = r.id)
              else r.id end
    from (select real_member_id() as id) r
$$;

-- 0015's current_member, 0016's current_app_user_id, 0080's
-- current_business_id and current_has_permission, current_has_role, and
-- 0057's current_work_place: each now asks session_member_id.
create or replace function current_member() returns app_user
language sql stable security definer set search_path = public as $$
  select * from app_user where id = session_member_id()
$$;

create or replace function current_app_user_id() returns uuid
language sql stable security definer set search_path = public as $$
  select session_member_id()
$$;

create or replace function current_business_id() returns uuid
language sql stable security definer set search_path = public as $$
  select business_id from app_user where id = session_member_id() and not two_step_pending()
$$;

create or replace function current_has_permission(p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select not two_step_pending() and exists (
    select 1 from user_role ur join role_permission rp on rp.role = ur.role
     where ur.app_user_id = session_member_id() and rp.permission = p_permission)
$$;

create or replace function current_has_role(target app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_role ur where ur.app_user_id = session_member_id() and ur.role = target)
$$;

create or replace function current_work_place() returns uuid
language sql stable security definer set search_path = public as $$
  select member_place(session_member_id())
$$;

-- 0091's my_profile, for the person this request acts as, saying whether it is practice.
create or replace function my_profile() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when m.id is null then null else jsonb_build_object(
    'id', m.id, 'name', m.full_name, 'business_id', m.business_id,
    'business_name', (select name from business where id = m.business_id),
    'timezone', (select timezone from business where id = m.business_id),
    'currency', (select currency_code from business where id = m.business_id),
    'currency_decimals', (select currency_decimals from business where id = m.business_id),
    'discount_round_to', rule_value(m.business_id, 'discount_round_to'),
    'discount_cap_percent', member_rule_number(m.business_id, 'discount_cap_percent', m.id),
    'refund_approval_over', member_rule_number(m.business_id, 'refund_approval_over', m.id),
    'waste_approval_over', member_rule_number(m.business_id, 'waste_approval_over', m.id),
    'waste_approval_window', rule_value(m.business_id, 'waste_approval_window'),
    'has_pin', m.pin_hash is not null,
    'roles', coalesce((select jsonb_agg(role order by role) from user_role where app_user_id = m.id), '[]'),
    'permissions', coalesce((select jsonb_agg(distinct rp.permission order by rp.permission)
                               from user_role ur join role_permission rp on rp.role = ur.role
                              where ur.app_user_id = m.id), '[]'),
    'works_at', member_place(m.id),
    'works_at_name', (select l.name from location l where l.id = member_place(m.id)),
    'practice', (select practice_of is not null from business where id = m.business_id))
  end
  from (select * from app_user where id = session_member_id()) m
  right join (select 1) one on true
$$;

-- -----------------------------------------------------------------------------
-- 2. The practice café
-- -----------------------------------------------------------------------------
-- A practice café for a person: two places, the person's twin with their roles,
-- two practice colleagues (a cashier, and a counter whose count waits for a
-- manager), a small menu with its recipes and prices, stock in the books, a
-- supplier and two tables. Returns the twin.
create or replace function practice_seed(p_member uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  m app_user; r business; b uuid; v_branch uuid; v_kitchen uuid; v_twin uuid; v_sara uuid; v_omar uuid;
  c_coffee uuid; c_bakery uuid; c_drinks uuid;
  i_beans uuid; i_milk uuid; i_cups uuid; i_croissant uuid; i_water uuid; i_sugar uuid; i_base uuid;
  p uuid; v uuid; rc uuid; rv uuid; mv record; v_count uuid;
begin
  select * into m from app_user where id = p_member;
  select * into r from business where id = m.business_id;
  insert into business (name, currency_code, currency_symbol, currency_decimals, timezone, default_locale,
                        bill_prefix, practice_of)
  values ('Practice café', r.currency_code, r.currency_symbol, r.currency_decimals, r.timezone, r.default_locale,
          'PRAC', r.id)
  returning id into b;
  insert into location (business_id, kind, name, name_ar, name_ckb)
  values (b, 'branch', 'Practice branch', 'فرع التدريب', 'لقی ڕاهێنان') returning id into v_branch;
  insert into location (business_id, kind, name, name_ar, name_ckb)
  values (b, 'central_kitchen', 'Practice kitchen', 'مطبخ التدريب', 'چێشتخانەی ڕاهێنان') returning id into v_kitchen;

  -- The person, and two colleagues.
  insert into app_user (business_id, full_name, pin_hash) values (b, m.full_name, m.pin_hash) returning id into v_twin;
  insert into user_role (app_user_id, role, location_id, business_id)
  select v_twin, ur.role, case when ur.location_id is not null then v_branch end, b
    from user_role ur where ur.app_user_id = m.id;
  insert into app_user (business_id, full_name) values (b, 'Sara (practice)') returning id into v_sara;
  insert into user_role (app_user_id, role, business_id) values (v_sara, 'cashier', b);
  insert into app_user (business_id, full_name) values (b, 'Omar (practice)') returning id into v_omar;
  insert into user_role (app_user_id, role, business_id) values (v_omar, 'inventory_counter', b);

  -- Stock.
  insert into item (business_id, sku, name, name_ar, name_ckb, item_type, base_unit_code, dimension, returnable_to_stock, min_level_base)
  values (b, 'P-BEANS', 'Coffee beans', 'حبوب القهوة', 'دانەوێڵەی قاوە', 'ingredient', 'g', 'mass', false, 2000) returning id into i_beans;
  insert into item (business_id, sku, name, name_ar, name_ckb, item_type, base_unit_code, dimension, returnable_to_stock, min_level_base)
  values (b, 'P-MILK', 'Milk', 'حليب', 'شیر', 'ingredient', 'ml', 'volume', false, 4000) returning id into i_milk;
  insert into item (business_id, sku, name, name_ar, name_ckb, item_type, base_unit_code, dimension, returnable_to_stock, min_level_base)
  values (b, 'P-CUP', 'Paper cup', 'كوب ورقي', 'کوپی کاغەز', 'packaging', 'each', 'count', false, 50) returning id into i_cups;
  insert into item (business_id, sku, name, name_ar, name_ckb, item_type, base_unit_code, dimension, returnable_to_stock)
  values (b, 'P-CROISSANT', 'Croissant', 'كرواسون', 'کرواسۆن', 'resale', 'each', 'count', false) returning id into i_croissant;
  insert into item (business_id, sku, name, name_ar, name_ckb, item_type, base_unit_code, dimension, returnable_to_stock)
  values (b, 'P-WATER', 'Water bottle', 'قنينة ماء', 'بوتڵی ئاو', 'resale', 'each', 'count', true) returning id into i_water;
  insert into item (business_id, sku, name, name_ar, name_ckb, item_type, base_unit_code, dimension, returnable_to_stock)
  values (b, 'P-SUGAR', 'Sugar', 'سكر', 'شەکر', 'ingredient', 'g', 'mass', false) returning id into i_sugar;
  -- Made here, in batches: what a barista records on Production.
  insert into item (business_id, sku, name, name_ar, name_ckb, item_type, base_unit_code, dimension, returnable_to_stock)
  values (b, 'P-BASE', 'Vanilla base', 'قاعدة الفانيلا', 'بنکەی ڤانیلا', 'finished_good', 'ml', 'volume', false)
  returning id into i_base;
  insert into item_unit (item_id, code, label, dimension, factor_to_base) values
    (i_sugar, 'kg', 'Kilogram', 'mass', 1000),
    (i_base, 'L', 'Litre', 'volume', 1000),
    (i_beans, 'kg', 'Kilogram', 'mass', 1000),
    (i_milk, 'carton_1l', 'Carton of 1 L', 'volume', 1000),
    (i_cups, 'sleeve_50', 'Sleeve of 50', 'count', 50),
    (i_water, 'case_24', 'Case of 24', 'count', 24);
  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reason, occurred_at)
  values (b, i_beans, v_branch, 'opening_balance', 5000, 20, 100000, 'Practice stock', now() - interval '1 day'),
         (b, i_milk, v_branch, 'opening_balance', 10000, 1.5, 15000, 'Practice stock', now() - interval '1 day'),
         (b, i_cups, v_branch, 'opening_balance', 200, 100, 20000, 'Practice stock', now() - interval '1 day'),
         (b, i_croissant, v_branch, 'opening_balance', 30, 750, 22500, 'Practice stock', now() - interval '1 day'),
         (b, i_water, v_branch, 'opening_balance', 48, 250, 12000, 'Practice stock', now() - interval '1 day'),
         (b, i_sugar, v_branch, 'opening_balance', 5000, 1.5, 7500, 'Practice stock', now() - interval '1 day'),
         (b, i_beans, v_kitchen, 'opening_balance', 3000, 20, 60000, 'Practice stock', now() - interval '1 day');
  for mv in select id, value from inventory_movement where business_id = b and type = 'opening_balance' loop
    perform post_journal(b, now() - interval '1 day', 'Opening stock (practice)', 'inventory_movement', mv.id,
      jsonb_build_array(jsonb_build_object('code', '1200', 'debit', mv.value),
                        jsonb_build_object('code', '3000', 'credit', mv.value)));
  end loop;

  -- The menu.
  insert into product_category (business_id, name, name_ar, name_ckb, sort_order)
  values (b, 'Coffee', 'القهوة', 'قاوە', 1) returning id into c_coffee;
  insert into product_category (business_id, name, name_ar, name_ckb, sort_order)
  values (b, 'Bakery', 'المخبوزات', 'نانەواخانە', 2) returning id into c_bakery;
  insert into product_category (business_id, name, name_ar, name_ckb, sort_order)
  values (b, 'Drinks', 'المشروبات', 'خواردنەوەکان', 3) returning id into c_drinks;

  -- A product made from a recipe: its variant, recipe and price on both ways of selling.
  -- (Espresso; Latte small and large.)
  insert into product (business_id, category_id, name, name_ar, name_ckb, is_favourite)
  values (b, c_coffee, 'Espresso', 'إسبريسو', 'ئێسپرێسۆ', true) returning id into p;
  insert into product_variant (business_id, product_id, name, name_ar, name_ckb)
  values (b, p, 'Single', 'مفرد', 'تاک') returning id into v;
  insert into recipe (business_id, name) values (b, 'Espresso') returning id into rc;
  insert into recipe_version (recipe_id, version_no, effective_from) values (rc, 1, '2020-01-01') returning id into rv;
  insert into recipe_line (recipe_version_id, component_type, item_id, quantity, unit_code, applies_to_channels)
  values (rv, 'item', i_beans, 18, 'g', null), (rv, 'item', i_cups, 1, 'each', '{takeaway}');
  insert into variant_recipe (product_variant_id, recipe_id) values (v, rc);
  insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
  values (b, v, 'dine_in', 2000, '2020-01-01'), (b, v, 'takeaway', 2000, '2020-01-01');

  insert into product (business_id, category_id, name, name_ar, name_ckb, is_favourite)
  values (b, c_coffee, 'Latte', 'لاتيه', 'لاتێ', true) returning id into p;
  insert into product_variant (business_id, product_id, name, name_ar, name_ckb)
  values (b, p, 'Small', 'صغير', 'بچووک') returning id into v;
  insert into recipe (business_id, name) values (b, 'Latte small') returning id into rc;
  insert into recipe_version (recipe_id, version_no, effective_from) values (rc, 1, '2020-01-01') returning id into rv;
  insert into recipe_line (recipe_version_id, component_type, item_id, quantity, unit_code, applies_to_channels)
  values (rv, 'item', i_beans, 18, 'g', null), (rv, 'item', i_milk, 180, 'ml', null),
         (rv, 'item', i_cups, 1, 'each', '{takeaway}');
  insert into variant_recipe (product_variant_id, recipe_id) values (v, rc);
  insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
  values (b, v, 'dine_in', 3500, '2020-01-01'), (b, v, 'takeaway', 3500, '2020-01-01');
  insert into product_variant (business_id, product_id, name, name_ar, name_ckb)
  values (b, p, 'Large', 'كبير', 'گەورە') returning id into v;
  insert into recipe (business_id, name) values (b, 'Latte large') returning id into rc;
  insert into recipe_version (recipe_id, version_no, effective_from) values (rc, 1, '2020-01-01') returning id into rv;
  insert into recipe_line (recipe_version_id, component_type, item_id, quantity, unit_code, applies_to_channels)
  values (rv, 'item', i_beans, 18, 'g', null), (rv, 'item', i_milk, 300, 'ml', null),
         (rv, 'item', i_cups, 1, 'each', '{takeaway}');
  insert into variant_recipe (product_variant_id, recipe_id) values (v, rc);
  insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
  values (b, v, 'dine_in', 4500, '2020-01-01'), (b, v, 'takeaway', 4500, '2020-01-01');

  -- Bought in and sold as it is.
  insert into product (business_id, category_id, name, name_ar, name_ckb)
  values (b, c_bakery, 'Croissant', 'كرواسون', 'کرواسۆن') returning id into p;
  insert into product_variant (business_id, product_id, name, name_ar, name_ckb, resale_item_id)
  values (b, p, 'Each', 'قطعة', 'دانە', i_croissant) returning id into v;
  insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
  values (b, v, 'dine_in', 2000, '2020-01-01'), (b, v, 'takeaway', 2000, '2020-01-01');
  insert into product (business_id, category_id, name, name_ar, name_ckb)
  values (b, c_drinks, 'Water', 'ماء', 'ئاو') returning id into p;
  insert into product_variant (business_id, product_id, name, name_ar, name_ckb, resale_item_id)
  values (b, p, 'Bottle', 'قنينة', 'بوتڵ', i_water) returning id into v;
  insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
  values (b, v, 'dine_in', 1000, '2020-01-01'), (b, v, 'takeaway', 1000, '2020-01-01');

  -- The vanilla base: 5 L a batch, from 4 L of milk and 800 g of sugar; keeps three days.
  insert into recipe (business_id, name, output_item_id, batch_yield_base, batch_yield_unit, shelf_life_hours,
                      prep_instructions)
  values (b, 'Vanilla base', i_base, 5000, 'L', 72, 'Heat the milk and sugar to 85°C, then cool.')
  returning id into rc;
  insert into recipe_version (recipe_id, version_no, effective_from) values (rc, 1, '2020-01-01') returning id into rv;
  insert into recipe_line (recipe_version_id, component_type, item_id, quantity, unit_code, applies_to_channels)
  values (rv, 'item', i_milk, 4000, 'ml', null), (rv, 'item', i_sugar, 800, 'g', null);

  insert into supplier (business_id, name, contact, lead_time_days)
  values (b, 'Practice supplier', 'Coffee, milk and cups', 1);
  insert into dining_table (business_id, location_id, name, seats, sort_order)
  values (b, v_branch, 'Table 1', 4, 1), (b, v_branch, 'Table 2', 2, 2);

  -- Omar's count of the kitchen's coffee beans, sent for a manager: 50 g short.
  -- In the kitchen, so the branch is free for a counter's own count.
  insert into stock_count (business_id, location_id, count_type, status, is_blind, started_at, counted_by)
  values (b, v_kitchen, 'cycle', 'counting', true, now() - interval '2 hours', v_omar)
  returning id into v_count;
  insert into stock_count_line (business_id, stock_count_id, item_id, expected_base, counted_base, expected_at_count, counted_at)
  values (b, v_count, i_beans, 3000, 2950, 3000, now() - interval '1 hour');
  update stock_count set status = 'submitted', submitted_at = now() - interval '1 hour' where id = v_count;
  return v_twin;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Starting, starting again, and the tasks
-- -----------------------------------------------------------------------------
-- The tasks, each for the people who may do it, in the order they are learnt.
create or replace function practice_task_list()
returns table (task text, permission text, sort int)
language sql immutable as $$
  values ('open_drawer', 'sale.create', 10), ('sell_card', 'sale.create', 20), ('sell_cash', 'sale.create', 30),
         ('discount', 'discount.apply', 40), ('table_bill', 'sale.create', 50), ('refund', 'sale.refund', 60),
         ('void', 'sale.void', 70), ('close_drawer', 'sale.create', 80), ('batch', 'production.record', 90),
         ('waste', 'waste.record', 100), ('count', 'inventory.count', 110),
         ('approve_count', 'inventory.adjust.approve', 120), ('order', 'purchase.create', 130),
         ('receive', 'purchase.receive', 140), ('transfer', 'stock.transfer', 150),
         ('expense', 'expense.record', 160), ('price', 'settings.manage', 170), ('reports', 'cost.view', 180)
$$;

-- Whether the twin has done a task in the practice café.
create or replace function practice_task_met(p_task text, p_twin uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare b uuid := (select business_id from app_user where id = p_twin);
  did_audit boolean;
begin
  if b is null then return false; end if;
  return case p_task
    when 'open_drawer' then exists (select 1 from work_shift where business_id = b and opened_by = p_twin)
    when 'close_drawer' then exists (select 1 from work_shift where business_id = b and closed_at is not null
                                       and coalesce(closed_by, cashier_id, opened_by) = p_twin)
    when 'sell_card' then exists (
      select 1 from sales_order o where o.business_id = b and o.cashier_id = p_twin and o.status <> 'voided'
         and exists (select 1 from sales_tender t where t.sales_order_id = o.id and t.tender_type = 'card')
         and (select coalesce(sum(l.quantity), 0) from sales_order_line l
               where l.sales_order_id = o.id and l.product_name ilike 'Latte%') >= 2)
    when 'sell_cash' then exists (
      select 1 from sales_order o join sales_tender t on t.sales_order_id = o.id
       where o.business_id = b and o.cashier_id = p_twin and t.tender_type = 'cash' and coalesce(t.change_given, 0) > 0)
    when 'discount' then exists (select 1 from sales_order where business_id = b and cashier_id = p_twin
                                    and coalesce(discount_amount, 0) > 0)
    when 'table_bill' then exists (select 1 from pos_tab where business_id = b and opened_by = p_twin
                                      and table_id is not null and sales_order_id is not null)
    when 'refund' then exists (select 1 from sale_refund where business_id = b and requested_by = p_twin)
    when 'void' then exists (select 1 from sale_adjustment where business_id = b and kind = 'void'
                                and requested_by = p_twin)
    when 'count' then exists (select 1 from stock_count where business_id = b and counted_by = p_twin
                                 and submitted_at is not null)
    when 'approve_count' then exists (select 1 from stock_count where business_id = b and approved_by = p_twin)
    when 'order' then exists (select 1 from purchase_order where business_id = b and created_by = p_twin
                                 and sent_at is not null)
    when 'reports' then (select count(distinct path) from report_visit where app_user_id = p_twin) >= 3
    else exists (select 1 from audit_log a where a.business_id = b and a.app_user_id = p_twin
                    and a.action = any (case p_task
                      when 'batch' then array['production.record']
                      when 'waste' then array['inventory.waste', 'inventory.loss']
                      when 'receive' then array['purchase.receive']
                      when 'transfer' then array['stock.transfer_send']
                      when 'expense' then array['expense.record']
                      when 'price' then array['price.set', 'price.update']
                      else array[]::text[] end))
  end;
end $$;

-- The person signed in, for practice: not while their second step is to take.
create or replace function practice_member() returns app_user
language plpgsql stable security definer set search_path = public as $$
declare m app_user;
begin
  select * into m from app_user where id = real_member_id();
  if m.id is null then raise exception 'Sign in to continue' using errcode = '28000'; end if;
  if two_step_pending() then
    raise exception 'Finish signing in: type the code from your authenticator app' using errcode = '28000';
  end if;
  if exists (select 1 from business where id = m.business_id and practice_of is not null) then
    raise exception 'Practice is for the café''s own people';
  end if;
  return m;
end $$;

-- (anyone) Their tasks, each ticked (and kept ticked) once done in practice.
create or replace function practice_tasks() returns jsonb
language plpgsql security definer set search_path = public as $$
declare m app_user := practice_member(); w uuid; x record; v jsonb := '[]';
begin
  select twin_id into w from practice_twin where app_user_id = m.id;
  for x in select l.task, l.sort from practice_task_list() l
            where exists (select 1 from user_role ur join role_permission rp on rp.role = ur.role
                           where ur.app_user_id = m.id and rp.permission = l.permission)
            order by l.sort loop
    if w is not null and not exists (select 1 from practice_task_done d where d.app_user_id = m.id and d.task = x.task)
       and practice_task_met(x.task, w) then
      insert into practice_task_done (app_user_id, task) values (m.id, x.task) on conflict do nothing;
    end if;
    v := v || jsonb_build_object('task', x.task,
      'done_at', (select done_at from practice_task_done d where d.app_user_id = m.id and d.task = x.task));
  end loop;
  return jsonb_build_object('started', w is not null,
    'started_at', (select started_at from practice_twin where app_user_id = m.id), 'tasks', v);
end $$;

-- (anyone) Practice begun: their practice café, made once.
create or replace function practice_start() returns jsonb
language plpgsql security definer set search_path = public as $$
declare m app_user := practice_member();
begin
  perform pg_advisory_xact_lock(hashtext('practice:' || m.id::text));
  if not exists (select 1 from practice_twin t join app_user w on w.id = t.twin_id and w.is_active
                  where t.app_user_id = m.id) then
    delete from practice_twin where app_user_id = m.id;
    insert into practice_twin (app_user_id, twin_id) values (m.id, practice_seed(m.id));
    perform audit_event(m.business_id, 'practice.start', 'app_user', m.id::text, null, null, '{}'::jsonb);
  end if;
  return practice_tasks();
end $$;

-- (anyone) A fresh practice café, as on the first day; the ticks stay.
create or replace function practice_reset() returns jsonb
language plpgsql security definer set search_path = public as $$
declare m app_user := practice_member(); w uuid;
begin
  perform pg_advisory_xact_lock(hashtext('practice:' || m.id::text));
  select twin_id into w from practice_twin where app_user_id = m.id;
  if w is null then return practice_start(); end if;
  update app_user set is_active = false where id = w;
  update practice_twin set twin_id = practice_seed(m.id), started_at = now() where app_user_id = m.id;
  perform audit_event(m.business_id, 'practice.reset', 'app_user', m.id::text, null, null, '{}'::jsonb);
  return practice_tasks();
end $$;

-- (staff.manage, in the real café) Each person: their tasks done of all, and ready when all are.
create or replace function practice_team() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m app_user := practice_member();
begin
  if not exists (select 1 from user_role ur join role_permission rp on rp.role = ur.role
                  where ur.app_user_id = m.id and rp.permission = 'staff.manage') then
    raise exception 'You do not have permission to do this (needs %)', 'staff.manage' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'roles', p.roles,
             'tasks', p.total, 'done', p.done, 'started_at', p.started_at, 'last_done_at', p.last_done)
           order by p.full_name)
      from (select u.id, u.full_name,
                   (select jsonb_agg(distinct ur.role) from user_role ur where ur.app_user_id = u.id) as roles,
                   (select count(*) from practice_task_list() l
                     where exists (select 1 from user_role ur join role_permission rp on rp.role = ur.role
                                    where ur.app_user_id = u.id and rp.permission = l.permission)) as total,
                   (select count(*) from practice_task_done d join practice_task_list() l on l.task = d.task
                     where d.app_user_id = u.id
                       and exists (select 1 from user_role ur join role_permission rp on rp.role = ur.role
                                    where ur.app_user_id = u.id and rp.permission = l.permission)) as done,
                   (select started_at from practice_twin where app_user_id = u.id) as started_at,
                   (select max(done_at) from practice_task_done where app_user_id = u.id) as last_done
              from app_user u
             where u.business_id = m.business_id and u.is_active and u.auth_user_id is not null) p), '[]'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- 4. Who may call what
-- -----------------------------------------------------------------------------
revoke execute on function practicing(), real_member_id(), session_member_id(), practice_seed(uuid),
  practice_task_list(), practice_task_met(text, uuid), practice_member() from public, anon, authenticated;
revoke execute on function practice_tasks(), practice_start(), practice_reset(), practice_team()
  from public, anon;
grant execute on function practice_tasks(), practice_start(), practice_reset(), practice_team() to authenticated;
-- The functions every rule asks keep their grants (create or replace keeps them).
