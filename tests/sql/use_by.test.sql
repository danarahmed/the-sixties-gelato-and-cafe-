-- =============================================================================
-- Use-by for everything that goes off (0098): each item chooses how it keeps;
-- a delivery of what goes off makes a lot with its use-by (its days from
-- delivery, or the date on the pack, which must be given); a lot's use-by
-- changed only with a reason, by a manager; a batch recipe keeps a while or
-- doesn't go off; what is near or past its use-by listed and alerted ahead of
-- time; the till's marks; and the last guard, warn or refuse.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create temp table sup as select id from supplier where business_id = '00000000-0000-0000-0000-0000000000b1' limit 1;
grant select on sup to public;
create temp table ids as select
  'c0000000-0000-0000-0000-000000000001'::uuid beans, 'c0000000-0000-0000-0000-000000000002'::uuid cup,
  'c0000000-0000-0000-0000-000000000003'::uuid water, 'd1000000-0000-0000-0000-000000000002'::uuid bottle,
  business_local_date('00000000-0000-0000-0000-0000000000b1', now()) today;
grant select on ids to public;
-- Each open lot of an item, by its use-by: "D1-1=6 (2026-11-14)".
create function pg_temp.lots(p_item uuid) returns text language sql security definer as $$
  select coalesce(string_agg(l.lot_code || '=' || trim_scale(l.left_base) || ' (' || l.expiry_date || ')', ', '
                             order by l.use_by, l.lot_code), 'none')
    from item_lot l where l.item_id = p_item and l.left_base > 0
$$;
create function pg_temp.audits(p_action text) returns int language sql security definer as $$
  select count(*)::int from audit_log where action = p_action
$$;

-- ------------------------------------------------------------------ how each item keeps
select test.eq((select expiry_mode from item where id = (select cup from ids)), 'none',
  'packaging does not go off, from the start');
select test.eq((select expiry_mode from item where id = (select water from ids)), null::text,
  'the rest has not chosen yet');
select test.act_as('cashier@example.com');
select test.throws($$select set_item_use_by((select water from ids), 'exact_date')$$, '%permission%',
  'a cashier does not set how an item keeps');
select test.act_as('manager@example.com');
select test.throws($$select set_item_use_by((select beans from ids), 'keeps_days')$$, '%how many days%',
  'kept some days from delivery: how many');
select test.throws($$select set_item_use_by((select beans from ids), 'soon')$$, '%Choose how it keeps%',
  'one of the three ways');
select set_item_use_by((select beans from ids), 'keeps_days', 5);
select set_item_use_by((select water from ids), 'exact_date');
select test.eq((select keeps_days from item where id = (select beans from ids)), 5, 'the days are the item''s');
select test.ok(pg_temp.audits('item.use_by') = 2, 'each choice on the audit trail');

-- ------------------------------------------------------------------ deliveries
select test.throws($$select receive_goods((select id from sup),
  '[{"item_id":"c0000000-0000-0000-0000-000000000003","qty":6,"goods_value":1500}]')$$,
  '%Type the use-by printed on the pack of Golden water%', 'kept by its pack''s date: the date must be typed');
select test.throws(format($$select receive_goods((select id from sup),
  '[{"item_id":"c0000000-0000-0000-0000-000000000003","qty":6,"goods_value":1500,"use_by":"%s"}]')$$,
  (select today - 1 from ids)), '%already past its use-by%', 'not a pack already past its use-by');
insert into res select 'W1', receive_goods((select id from sup),
  jsonb_build_array(jsonb_build_object('item_id', (select water from ids), 'qty', 6, 'goods_value', 1500,
                                       'use_by', (select today + 2 from ids))), p_confirm => true);
select test.eq((select track_lot from item where id = (select water from ids)), true, 'the water is kept lot by lot now');
select test.eq(pg_temp.lots((select water from ids)),
  format('D%s-1=6 (%s)', pg_temp.r('W1') ->> 'receipt_no', (select today + 2 from ids)),
  'the delivery is a lot of its own, used by the date on the pack');
select test.eq((select count(*) from lot_movement where item_id = (select water from ids) and lot_id is null)::int, 1,
  'what was on the shelf before stays stock with no lot');
insert into res select 'B1', receive_goods((select id from sup),
  '[{"item_id":"c0000000-0000-0000-0000-000000000001","qty":1,"unit_code":"kg","goods_value":10000}]', p_confirm => true);
select test.eq(pg_temp.lots((select beans from ids)),
  format('D%s-1=1000 (%s)', pg_temp.r('B1') ->> 'receipt_no', (select today + 5 from ids)),
  'kept five days from delivery: used by five days from today, by itself');
insert into res select 'C1', receive_goods((select id from sup),
  '[{"item_id":"c0000000-0000-0000-0000-000000000002","qty":50,"goods_value":2500}]', p_confirm => true);
select test.eq(pg_temp.lots((select cup from ids)), 'none', 'what does not go off makes no lot');

-- ------------------------------------------------------------------ a lot's use-by changed
select test.as_admin();
insert into res select 'lotW', to_jsonb((select id from item_lot where item_id = (select water from ids) limit 1));
select test.act_as('cashier@example.com');
select test.throws($$select set_lot_use_by((pg_temp.r('lotW') #>> '{}')::uuid, (select today + 3 from ids), 'read again')$$,
  '%permission%', 'a cashier does not change a use-by');
select test.act_as('manager@example.com');
select test.throws($$select set_lot_use_by((pg_temp.r('lotW') #>> '{}')::uuid, (select today + 3 from ids), ' ')$$,
  '%Say why%', 'never without a reason');
select set_lot_use_by((pg_temp.r('lotW') #>> '{}')::uuid, (select today + 3 from ids), 'The pack read again');
select test.ok(pg_temp.lots((select water from ids)) like format('%%(%s)', (select today + 3 from ids)), 'changed');
select test.eq(pg_temp.audits('stock.use_by'), 1, 'and on the audit trail, with why');

-- ------------------------------------------------------------------ recipes keep a while, or don't go off
select test.act_as('owner@example.com');
select create_item('Use-by syrup', 'sub_recipe_output', 'ml', 'volume');
select test.throws($$select save_batch_recipe(null, 'Use-by syrup',
  jsonb_build_object('item_id', (select id from item where name = 'Use-by syrup')), 1000, 'ml',
  jsonb_build_array(jsonb_build_object('item_id', (select beans from ids), 'qty', 10, 'unit_code', 'g')), null, true)$$,
  '%how long what it makes keeps, or that it doesn''t go off%', 'a recipe says how long it keeps');
insert into res select 'R', save_batch_recipe(null, 'Use-by syrup',
  jsonb_build_object('item_id', (select id from item where name = 'Use-by syrup')), 1000, 'ml',
  jsonb_build_array(jsonb_build_object('item_id', (select beans from ids), 'qty', 10, 'unit_code', 'g')), null, true, 0);
select test.eq((select never_goes_off from recipe where id = (pg_temp.r('R') ->> 'recipe_id')::uuid), true,
  'or that it doesn''t go off');
select save_batch_recipe((pg_temp.r('R') ->> 'recipe_id')::uuid, 'Use-by syrup', null, 1000, 'ml', null, null, true, 72);
select test.eq((select never_goes_off from recipe where id = (pg_temp.r('R') ->> 'recipe_id')::uuid), false,
  'given hours, it keeps that long');

-- ------------------------------------------------------------------ near and past their use-by
select test.as_admin();
-- Time passes: the water's lot goes off.
update item_lot set use_by = now() - interval '1 hour' where id = (pg_temp.r('lotW') #>> '{}')::uuid;
select test.act_as('cashier@example.com');
insert into res select 'L', use_by_lots();
select test.eq((select l ->> 'status' from jsonb_array_elements(pg_temp.r('L') -> 'lots') l
                 where l ->> 'item' = 'Golden water'), 'expired', 'the counter sees what to take off the shelf');
select test.eq((select l ->> 'kind' from jsonb_array_elements(pg_temp.r('L') -> 'lots') l
                 where l ->> 'item' = 'Golden water'), 'delivery', 'a delivery''s lot');
select test.eq(jsonb_array_length(pg_temp.r('L') -> 'unset_items'), 0, 'a cashier is not shown the set-up to do');
select test.act_as('manager@example.com');
select test.ok(exists (select 1 from jsonb_array_elements(use_by_lots() -> 'unset_items') u
                        where u ->> 'name' = 'Golden cup') is false, 'packaging has chosen');
select test.as_admin();
select test.ok(exists (select 1 from alert_conditions('00000000-0000-0000-0000-0000000000b1', now()) a
                        where a.rule = 'use_by' and a.urgency = 'red' and a.title like 'Golden water, delivered %'
                          and a.link = '/inventory#use-by'), 'a red alert for the water past its use-by');
select test.ok(not exists (select 1 from alert_conditions('00000000-0000-0000-0000-0000000000b1', now()) a
                            where a.rule = 'use_by' and a.title like 'Golden beans%'),
  'the beans, five days off, are not warned of yet');
select test.act_as('owner@example.com');
select set_business_rule('use_by_warn_hours', 'business', '', '168', 'Warn a week ahead');
select test.as_admin();
select test.ok(exists (select 1 from alert_conditions('00000000-0000-0000-0000-0000000000b1', now()) a
                        where a.rule = 'use_by' and a.urgency = 'orange' and a.title like 'Golden beans, delivered %'),
  'with a week''s warning, the beans are');

-- ------------------------------------------------------------------ the till
select test.act_as('cashier@example.com');
select test.eq(jsonb_array_length(pos_use_by()), 0, 'stock with no lot sells first: no mark yet');
-- 25 bottles: the 24 on the shelf, and one from the lot past its use-by.
select record_sale(gen_random_uuid(), 'dine_in', 'card',
  jsonb_build_array(jsonb_build_object('variant_id', (select bottle from ids), 'qty', 25)));
select test.eq(pg_temp.audits('stock.expired_sold'), 1, 'warned by default: sold, and kept on the audit trail');
select test.eq((select p ->> 'state' from jsonb_array_elements(pos_use_by()) p
                 where p ->> 'variant_id' = (select bottle from ids)::text), 'expired',
  'now the till marks the bottle: what is left is past its use-by');

select test.act_as('owner@example.com');
select set_business_rule('expired_sale', 'business', '', '"refuse"', 'Never sell what is past its use-by');
select test.act_as('cashier@example.com');
select test.throws($$select record_sale(gen_random_uuid(), 'dine_in', 'card',
  jsonb_build_array(jsonb_build_object('variant_id', (select bottle from ids), 'qty', 1)))$$,
  '%Golden water is past its use-by: a manager approves selling it%', 'refused: a manager approves it');
select test.act_as('manager@example.com');
select set_my_pin('2468');
select test.as_admin();
insert into res select 'M', to_jsonb((select id from app_user where email = 'manager@example.com'));
select test.act_as('cashier@example.com');
insert into res select 'A', to_jsonb(request_approval('negative_stock', (pg_temp.r('M') #>> '{}')::uuid, '2468', '{}')
  ->> 'approval_id');
select record_sale(gen_random_uuid(), 'dine_in', 'card',
  jsonb_build_array(jsonb_build_object('variant_id', (select bottle from ids), 'qty', 1)),
  p_stock_approval => (pg_temp.r('A') #>> '{}')::uuid);
select test.eq(pg_temp.audits('stock.expired_sold'), 2, 'with the manager''s PIN it is sold, and who approved kept');

-- A fresh delivery: the next bottle is good again, and warned of as soon.
select test.act_as('manager@example.com');
select receive_goods((select id from sup),
  jsonb_build_array(jsonb_build_object('item_id', (select water from ids), 'qty', 6, 'goods_value', 1500,
                                       'use_by', (select today from ids))), p_confirm => true);
select test.act_as('cashier@example.com');
select test.eq((select p ->> 'state' from jsonb_array_elements(pos_use_by()) p
                 where p ->> 'variant_id' = (select bottle from ids)::text), 'soon',
  'a bottle going off today is marked to sell first');
select record_sale(gen_random_uuid(), 'dine_in', 'card',
  jsonb_build_array(jsonb_build_object('variant_id', (select bottle from ids), 'qty', 1)));
select test.eq(pg_temp.audits('stock.expired_sold'), 2, 'the good lot sells before the one past its use-by');

-- ------------------------------------------------------------------ back to the default
select test.act_as('owner@example.com');
select set_business_rule('expired_sale', 'business', '', null, 'Back to warning');
select test.as_admin();
select test.eq(rule_value('00000000-0000-0000-0000-0000000000b1', 'expired_sale') #>> '{}', 'warn', 'warning is the default');
select test.as_admin();
select test.ok(not has_function_privilege('authenticated', 'expired_takes(uuid, uuid, jsonb)', 'execute'),
  'the guard''s workings are not callable from outside');
