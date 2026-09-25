-- =============================================================================
-- Delivery platforms the café adds itself (0031): the owner adds one, with its
-- names in other languages; it takes its packaging, and its prices from today,
-- from a channel it works like; it sells as Talabat does, by the order number
-- from its tablet, and its statements are matched; it is renamed, taken out of
-- use (it sells nothing more and raises no margin or price alerts, while what
-- it owes stays) and brought back. Every step is on the audit trail.
-- Golden catalogue: espresso 2,500 dine-in and takeaway, 3,000 on Talabat,
-- costing 200 in beans and a 50 cup on takeaway and Talabat orders.
-- (Each statement commits on its own: a platform's code is usable once the
-- statement adding it is over.)
-- =============================================================================
select test.golden_catalogue();
create temp table s (k text primary key, r jsonb);
grant all on s to public;
create or replace function pg_temp.r(p text) returns jsonb language sql as $$ select r from s where k = p $$;
create or replace function pg_temp.espresso(p_channel text, p_no text default null,
                                            p_key uuid default gen_random_uuid()) returns jsonb
language sql as $$
  select record_sale(p_key, p_channel::sales_channel, 'platform_paid',
    jsonb_build_array(jsonb_build_object('variant_id', 'd1000000-0000-0000-0000-000000000001', 'qty', 1)),
    p_platform_order_no => p_no)
$$;
create or replace function pg_temp.channels() returns text language sql as $$
  select string_agg(code || case when is_active then '' else ' (not in use)' end, ', ' order by sort_order, name)
    from sales_channels()
$$;
create or replace function pg_temp.alerts(p_rule text) returns text language sql security definer as $$
  select string_agg(title, ' | ' order by title)
    from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())
   where rule = p_rule and title like 'Golden espresso%'
$$;
-- What a platform set up like Talabat, or like takeaway, would take from it.
create temp table n as select
  (select count(*) from recipe_line where 'talabat' = any (applies_to_channels))::int as talabat_lines,
  (select count(*) from product_variant pv
    where pv.business_id = '00000000-0000-0000-0000-0000000000b1' and pv.is_active
      and price_on(pv.id, 'talabat', null, test.today()) is not null)::int as talabat_prices,
  (select count(*) from recipe_line where 'takeaway' = any (applies_to_channels))::int as takeaway_lines;
grant all on n to public;
select test.ok((select talabat_lines > 1 and talabat_prices > 1 and takeaway_lines > 1 from n),
  'the demo menu has packaging and prices on Talabat and takeaway to copy');

-- ------------------------------------------------------- what is sold through
select test.act_as('cashier@example.com');
select test.eq(pg_temp.channels(),
  'dine_in, takeaway, direct_delivery, careem (not in use), talabat, toters (not in use)',
  'the till sees the shop''s three ways of selling, then the platforms, those not in use marked');
select test.eq((select string_agg(kind, ',' order by sort_order, name) from sales_channels()),
  'dine_in,takeaway,delivery,platform,platform,platform', 'each of its kind');
select test.act_as_anon();
select test.throws($$select * from sales_channels()$$, '%permission denied%', 'the public sees none of it');

-- ---------------------------------------------------------- a platform added
select test.act_as('manager@example.com');
select test.throws($$select add_delivery_platform('Lezzoo')$$, '%permission%',
  'a branch manager does not add a delivery platform');
select test.act_as('cashier@example.com');
select test.throws($$select add_delivery_platform('Lezzoo')$$, '%permission%', 'nor does a cashier');

select test.act_as('owner@example.com');
insert into s select 'lezzoo', add_delivery_platform(' Lezzoo ', null, '{"ar": "ليزو", "ckb": "لێزۆ", "en": " "}');
select test.eq(pg_temp.r('lezzoo') - 'id', '{"code": "lezzoo", "name": "Lezzoo"}'::jsonb,
  'its short name made from its name');
select test.eq((select names from sales_channels() where code = 'lezzoo'), '{"ar": "ليزو", "ckb": "لێزۆ"}'::jsonb,
  'its names in Arabic and Kurdish kept; an empty one left out');
select test.ok('lezzoo' = any (enum_range(null::sales_channel)::text[]), 'the café can sell through it');
insert into s select 'baly', add_delivery_platform('بلي', null, '{"ckb": "بەلی"}');
select test.eq(pg_temp.r('baly') ->> 'code', 'platform_1', 'a name in Arabic letters gets a short name of its own');
select test.eq(pg_temp.channels(),
  'dine_in, takeaway, direct_delivery, careem (not in use), talabat, toters (not in use), lezzoo, platform_1',
  'each new one after the others');

select test.throws($$select add_delivery_platform('LEZZOO')$$,
  'LEZZOO is already a delivery platform here: bring it back into use instead of adding it again',
  'a platform once, whatever the capitals');
select test.throws($$select add_delivery_platform('Talabat Express', 'talabat')$$,
  'A platform here already has the short name talabat: bring it back into use, or choose another',
  'a short name once');
select test.throws($$select add_delivery_platform('Talabat!')$$, '%already has the short name talabat%',
  'even when made from the name');
select test.throws($$select add_delivery_platform('Takeaway')$$,
  'takeaway is one of the shop''s own ways of selling, not a platform', 'not the shop''s own');
select test.throws($$select add_delivery_platform('Snoonu', 'Snoonu!')$$,
  'A platform''s short name is small Latin letters, digits and _, starting with a letter (lezzoo)',
  'a short name the till can keep');
select test.throws($$select add_delivery_platform('   ')$$, 'Name the platform as its customers know it%',
  'a name');
select test.throws(format('select add_delivery_platform(%L)', repeat('x', 61)), 'Name the platform%', 'a short one');
select test.throws($$select add_delivery_platform('Snoonu', null, '{"Arabic": "سنونو"}')$$,
  'Give each of the platform''s names under its language''s code (ar, ckb), in up to 60 letters',
  'names by language code');
select test.throws(format('select add_delivery_platform(%L, null, %L)', 'Snoonu', jsonb_build_object('ar', repeat('س', 61))),
  'Give each of the platform''s names%', 'each a short one');
select test.throws($$select add_delivery_platform('Snoonu', null, '["سنونو"]')$$,
  'Give the platform''s names by language', 'names by language');
select test.eq((select count(*) from delivery_platform where code like 'snoonu%')::int, 0, 'nothing kept of a refusal');
select test.ok(not ('snoonu' = any (enum_range(null::sales_channel)::text[])), 'not even the code');

-- ------------------------------------------ set up like a channel it works like
select test.act_as('cashier@example.com');
select test.throws($$select pg_temp.espresso('lezzoo', 'LZ-0')$$, 'No lezzoo price is set for%',
  'before its prices, nothing sells on it');
select test.act_as('manager@example.com');
select test.throws($$select copy_platform_setup('lezzoo', 'talabat')$$, '%permission%',
  'a branch manager does not set it up');
select test.act_as('owner@example.com');
select test.throws($$select copy_platform_setup('uber', 'talabat')$$, 'Choose one of the café''s delivery platforms',
  'a platform of the café''s');
select test.throws($$select copy_platform_setup('lezzoo', 'lezzoo')$$, 'Choose a channel Lezzoo works like',
  'another channel');
select test.throws($$select copy_platform_setup('lezzoo', 'uber')$$, 'Choose a channel Lezzoo works like',
  'one of the café''s');
insert into s select 'setup', copy_platform_setup('lezzoo', 'talabat');
select test.eq(pg_temp.r('setup'), (select jsonb_build_object('lines', talabat_lines, 'prices', talabat_prices) from n),
  'each packaging line a Talabat order takes, and each price on Talabat');
select test.as_admin();
select test.eq((select applies_to_channels::text from recipe_line where item_id = 'c0000000-0000-0000-0000-000000000002'),
  '{takeaway,talabat,lezzoo}', 'a Lezzoo order takes the cup, as a Talabat one does');
select test.eq((select count(*) from recipe_line
                 where ('talabat' = any (applies_to_channels)) <> ('lezzoo' = any (applies_to_channels)))::int, 0,
  'and every other line a Talabat order takes, and only those');
select test.eq((select string_agg(trim_scale(price) || ' from ' || (effective_from = test.today()), ',')
                  from channel_price where channel = 'lezzoo' and product_variant_id = 'd1000000-0000-0000-0000-000000000001'),
  '3000 from true', 'the espresso priced as on Talabat, from today');
select test.eq((select count(*) from channel_price where channel = 'lezzoo'
                  and product_variant_id = 'd1000000-0000-0000-0000-000000000002')::int, 0,
  'the water, not sold on Talabat, not on Lezzoo either');
select test.eq((select reason from audit_log where action = 'price.set' order by id desc limit 1),
  'Priced as on Talabat when Lezzoo was added', 'the price''s reason on the audit trail');
select test.act_as('owner@example.com');
select test.eq(copy_platform_setup('lezzoo', 'talabat'), '{"lines": 0, "prices": 0}'::jsonb,
  'set up twice, nothing is doubled');
select test.eq(copy_platform_setup('platform_1', 'takeaway', false),
  (select jsonb_build_object('lines', takeaway_lines, 'prices', 0) from n),
  'the packaging alone, when its prices are its own');
select set_price('d1000000-0000-0000-0000-000000000001', 'platform_1', 200);

-- ------------------------------------------------------------- sold through it
select test.act_as('cashier@example.com');
select test.throws($$select pg_temp.espresso('lezzoo')$$, 'Enter the Lezzoo order number',
  'a Lezzoo sale takes the number from its tablet');
select test.throws($$select record_sale(gen_random_uuid(), 'lezzoo', 'cash',
                       '[{"variant_id":"d1000000-0000-0000-0000-000000000001","qty":1}]', p_platform_order_no => 'LZ-1')$$,
  '%platform-paid%', 'paid through the platform, never into the drawer');
insert into s select 'sale1', pg_temp.espresso('lezzoo', 'LZ-1');
insert into s select 'sale2', pg_temp.espresso('lezzoo', 'LZ-2', 'e0000000-0000-0000-0000-000000000002');
select test.eq(test.lines_of((pg_temp.r('sale1') ->> 'order_id')::uuid),
  '1100 Dr 3000 | 1200 Cr 250 | 4000 Cr 3000 | 5000 Dr 250',
  'at its price, owed by the platform, the espresso and its cup out of stock');
select test.eq(pg_temp.r('sale1') ->> 'platform_order_no', 'LZ-1', 'with its number');
select test.throws($$select pg_temp.espresso('lezzoo', 'lz-1')$$, 'Lezzoo order lz-1 is already recorded, on the sale of %',
  'an order once');
select test.succeeds($$select pg_temp.espresso('talabat', 'LZ-1')$$, 'the same number on another platform is another order');

select test.act_as('owner@example.com');
select test.eq((select p - 'waiting' - 'priced' from jsonb_array_elements(platform_money() -> 'platforms') p
                 where p ->> 'code' = 'lezzoo'),
  '{"code": "lezzoo", "name": "Lezzoo", "names": {"ar": "ليزو", "ckb": "لێزۆ"}, "active": true}'::jsonb,
  'what the platforms owe lists it');
select test.eq((select string_agg(p ->> 'code' || ' ' || (p ->> 'waiting'), ', ')
                  from jsonb_array_elements(platform_money() -> 'platforms') p),
  'careem 0, talabat 1, toters 0, lezzoo 2, platform_1 0', 'each with the orders waiting on it');
select test.eq((select string_agg(p ->> 'code' || ' ' || (p ->> 'priced'), ', ')
                  from jsonb_array_elements(platform_money() -> 'platforms') p),
  (select format('careem 0, talabat %s, toters 0, lezzoo %s, platform_1 1', talabat_prices, talabat_prices) from n),
  'and how many products the till can sell on it');
insert into s select 'match', match_platform_statement('lezzoo', '[{"order_no": "LZ-1", "payout": 2550, "commission": 450},
                                                                  {"order_no": "LZ-9", "payout": 1000}]');
select test.eq((select string_agg((x ->> 'order_no') || ' ' || (x ->> 'status'), ', ')
                  from jsonb_array_elements(pg_temp.r('match') -> 'lines') x),
  'LZ-1 matched, LZ-9 not_found', 'its statement matched to its orders by number');
insert into s select 'post', post_platform_settlement('lezzoo', 'LZ-STATEMENT-1',
  '[{"order_no": "LZ-1", "payout": 2550, "commission": 450}]');
select test.eq(test.lines_of((pg_temp.r('post') ->> 'settlement_id')::uuid),
  '1020 Dr 2550 | 1100 Cr 3000 | 5100 Dr 450', 'and its payout posted');

-- ----------------------------------------------------------------- renamed
select test.act_as('manager@example.com');
select test.throws($$select update_delivery_platform('lezzoo', 'Lezzoo Express', '{}', true)$$, '%permission%',
  'a branch manager does not rename it');
select test.act_as('owner@example.com');
select test.throws($$select update_delivery_platform('lezzoo', 'talabat', '{}', true)$$,
  'talabat is already a delivery platform here', 'not to another platform''s name');
select test.throws($$select update_delivery_platform('lezzoo', ' ', '{}', true)$$, 'Name the platform%', 'not to nothing');
select test.throws($$select update_delivery_platform('uber', 'Uber', '{}', true)$$,
  'Choose one of the café''s delivery platforms', 'one of the café''s');
select update_delivery_platform('Lezzoo', 'Lezzoo Express', '{"ar": "ليزو إكسبريس", "ckb": "لێزۆ ئێکسپرێس"}', null);
select test.eq((select name || ' ' || (names ->> 'ar') from sales_channels() where code = 'lezzoo'),
  'Lezzoo Express ليزو إكسبريس', 'renamed, in each language');
select test.act_as('cashier@example.com');
select test.throws($$select pg_temp.espresso('lezzoo')$$, 'Enter the Lezzoo Express order number',
  'the till names it as the café does');

-- ------------------------------------------------ taken out of use, brought back
select test.eq(pg_temp.alerts('margin'), 'Golden espresso — Single (بلي): sold below cost at 200 IQD, costing 250',
  'a platform in use is watched: its margin');
select test.eq(pg_temp.alerts('price_typo'), 'Golden espresso — Single is 3,000 IQD on Talabat but 200 on بلي',
  'and its prices beside the other channels'', named as the café names them');
select test.act_as('owner@example.com');
select update_delivery_platform('platform_1', 'بلي', '{"ckb": "بەلی"}', false);
select update_delivery_platform('lezzoo', 'Lezzoo Express', '{"ar": "ليزو إكسبريس", "ckb": "لێزۆ ئێکسپرێس"}', false);
select test.eq(pg_temp.alerts('margin') || pg_temp.alerts('price_typo'), null,
  'out of use, it raises no margin or price alerts');
select test.act_as('cashier@example.com');
select test.eq(pg_temp.channels(),
  'dine_in, takeaway, direct_delivery, careem (not in use), talabat, toters (not in use), lezzoo (not in use), platform_1 (not in use)',
  'the till sees it out of use');
select test.throws($$select pg_temp.espresso('lezzoo', 'LZ-3')$$,
  'Lezzoo Express is no longer in use: bring it back on Delivery Platforms to sell through it',
  'out of use, it sells nothing more');
select test.eq((pg_temp.espresso('lezzoo', 'LZ-2', 'e0000000-0000-0000-0000-000000000002') ->> 'order_id'),
  pg_temp.r('sale2') ->> 'order_id', 'a sale it made before, sent again from the till, is the sale already recorded');
select test.throws($$select pg_temp.espresso('careem', 'C-1')$$,
  'Careem is no longer in use: bring it back on Delivery Platforms to sell through it',
  'Careem, never used, sells nothing: it is not in use');
select test.act_as('owner@example.com');
select test.throws($$select copy_platform_setup('lezzoo', 'talabat')$$,
  'Lezzoo Express is not in use: bring it back first', 'set up once it is back');
select test.eq((select string_agg(p ->> 'code' || ' ' || (p ->> 'active') || ' ' || (p ->> 'waiting'), ', ')
                  from jsonb_array_elements(platform_money() -> 'platforms') p where p ->> 'code' = 'lezzoo'),
  'lezzoo false 1', 'what it owes stays, for its next statement');

select update_delivery_platform('lezzoo', 'Lezzoo Express', '{"ar": "ليزو إكسبريس", "ckb": "لێزۆ ئێکسپرێس"}', true);
select test.act_as('cashier@example.com');
select test.succeeds($$select pg_temp.espresso('lezzoo', 'LZ-3')$$, 'brought back, it sells again');

-- ------------------------------------------------------------ on the record
select test.act_as('owner@example.com');
select update_delivery_platform('lezzoo', 'Lezzoo Express', '{"ar": "ليزو إكسبريس", "ckb": "لێزۆ ئێکسپرێس"}', true);
select test.as_admin();
select test.eq((select string_agg(action || ' ' || coalesce(after_state ->> 'platform_code', ''), ', ' order by id)
                  from audit_log where action in ('platform.create', 'platform.setup', 'platform.update')),
  'platform.create lezzoo, platform.create platform_1, platform.setup lezzoo, platform.setup platform_1, '
  'platform.update lezzoo, platform.update platform_1, platform.update lezzoo, platform.update lezzoo',
  'each on the audit trail; set up or saved with no change, nothing more');
select test.eq((select before_state ->> 'name' || ' → ' || (after_state ->> 'name') from audit_log
                 where action = 'platform.update' order by id limit 1), 'Lezzoo → Lezzoo Express', 'what it was, and is');
select test.eq((select jsonb_build_object('like', after_state ->> 'set_up_like',
                                          'lines', (after_state ->> 'packaging_lines')::int,
                                          'prices', (after_state ->> 'prices_copied')::int)
                  from audit_log where action = 'platform.setup' order by id limit 1),
  (select jsonb_build_object('like', 'Talabat', 'lines', talabat_lines, 'prices', talabat_prices) from n),
  'what its setup copied, and from where');
select test.eq((select count(*) from delivery_platform where business_id = '00000000-0000-0000-0000-0000000000b2')::int, 0,
  'another business has none of it');
