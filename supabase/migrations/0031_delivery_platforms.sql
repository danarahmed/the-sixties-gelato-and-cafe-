-- =============================================================================
-- 0031 — Delivery platforms the café adds itself
-- =============================================================================
-- Talabat, Careem and Toters were the only platforms a sale could go through:
-- sales_channel is a fixed type, and nothing on a screen could add to it. Now
-- the owner (or general manager) adds a platform on Delivery Platforms, with
-- its name in each language, and it works as Talabat does: a button on the
-- till, its own prices, the packaging its orders take, the order number from
-- its tablet, what it owes by order, and its statements matched.
--
--  * add_delivery_platform adds the platform's code to sales_channel. A new
--    value of a type can be used only once the transaction adding it is
--    committed, so its prices and packaging are copied from a channel it
--    works like in a second call, copy_platform_setup.
--  * A platform can be renamed, and taken out of use: it then sells nothing
--    more, leaves the till and the price lists, and raises no margin or price
--    alerts; what it owes and its statements stay.
--  * Every channel but the shop's own three is a platform; sales_channels()
--    lists them in order, for the till, the menu and the reports.

-- =============================================================================
-- 1. Platforms: names in each language, an order, and valid codes
-- =============================================================================
alter table delivery_platform add column if not exists names jsonb not null default '{}';
alter table delivery_platform add column if not exists sort_order int not null default 0;
alter table delivery_platform add column if not exists created_at timestamptz not null default now();
update delivery_platform set sort_order = case code when 'talabat' then 1 when 'careem' then 2 when 'toters' then 3 else 4 end
 where sort_order = 0;
alter table delivery_platform add constraint delivery_platform_code_format check (code ~ '^[a-z][a-z0-9_]{1,29}$');
alter table delivery_platform add constraint delivery_platform_names_object check (jsonb_typeof(names) = 'object');

-- The three 0030 set up, named in Arabic and Kurdish as the till named them.
update delivery_platform set names = case code
    when 'talabat' then '{"ar": "طلبات", "ckb": "تەلەبات"}'::jsonb
    when 'careem' then '{"ar": "كريم", "ckb": "کەریم"}'::jsonb
    when 'toters' then '{"ar": "توترز", "ckb": "تۆتەرز"}'::jsonb end
 where code in ('talabat', 'careem', 'toters') and names = '{}';

-- 0030 set up Careem and Toters beside Talabat, but the till offered Talabat
-- only. Those never priced or sold through start out of use, so the till stays
-- as it was until the owner brings one in.
update delivery_platform dp set is_active = false
 where dp.code in ('careem', 'toters') and dp.is_active
   and not exists (select 1 from channel_price cp where cp.business_id = dp.business_id and cp.channel::text = dp.code)
   and not exists (select 1 from sales_order o where o.business_id = dp.business_id and o.channel::text = dp.code)
   and not exists (select 1 from platform_order po where po.platform_id = dp.id)
   and not exists (select 1 from platform_settlement ps where ps.platform_id = dp.id);

-- Every channel but dine-in, takeaway and direct delivery is a delivery platform.
create or replace function is_platform_channel(p_channel sales_channel) returns boolean
language sql immutable set search_path = public as $$
  select p_channel::text not in ('dine_in', 'takeaway', 'direct_delivery')
$$;

-- A channel the café sells through now: the shop's own, or a platform in use.
create or replace function channel_in_use(p_business uuid, p_channel sales_channel) returns boolean
language sql stable set search_path = public as $$
  select not is_platform_channel(p_channel)
      or coalesce((select dp.is_active from delivery_platform dp
                    where dp.business_id = p_business and dp.code = p_channel::text), false)
$$;

-- A channel's name in the alerts: a platform's as the café named it.
create or replace function alert_channel(p_business uuid, p_channel sales_channel) returns text
language sql stable set search_path = public as $$
  select coalesce(
    (select dp.name from delivery_platform dp where dp.business_id = p_business and dp.code = p_channel::text),
    replace(initcap(replace(p_channel::text, '_', ' ')), 'Dine In', 'Dine-in'))
$$;

-- A platform's names in other languages: {"ar": "طلبات", "ckb": "تەڵەبات"}; empty ones dropped.
create or replace function platform_names(p_names jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare v jsonb;
begin
  if p_names is null then return '{}'; end if;
  if jsonb_typeof(p_names) <> 'object' then raise exception 'Give the platform''s names by language'; end if;
  select coalesce(jsonb_object_agg(e.key, btrim(e.value #>> '{}')), '{}') into v
    from jsonb_each(p_names) e
   where jsonb_typeof(e.value) = 'string' and btrim(e.value #>> '{}') <> '';
  if exists (select 1 from jsonb_each_text(v) e
              where e.key !~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$' or length(e.value) > 60) then
    raise exception 'Give each of the platform''s names under its language''s code (ar, ckb), in up to 60 letters';
  end if;
  return v;
end $$;

-- =============================================================================
-- 2. The channels, in order: the shop's three, then the platforms
-- =============================================================================
create or replace function sales_channels()
returns table (code text, name text, names jsonb, kind text, is_active boolean, sort_order int)
language sql stable security definer set search_path = public as $$
  select v.code, v.name, '{}'::jsonb, v.kind, true, v.ord
    from (values ('dine_in', 'Dine-in', 'dine_in', 1), ('takeaway', 'Takeaway', 'takeaway', 2),
                 ('direct_delivery', 'Direct delivery', 'delivery', 3)) v(code, name, kind, ord)
   where current_business_id() is not null
  union all
  select dp.code, dp.name, dp.names, 'platform', dp.is_active, 10 + dp.sort_order
    from delivery_platform dp
   where dp.business_id = current_business_id()
     and dp.code in (select e.enumlabel::text from pg_enum e where e.enumtypid = 'sales_channel'::regtype)
   order by 6, 2
$$;

-- =============================================================================
-- 3. A platform added, set up like another channel, renamed, taken out of use
-- =============================================================================
create or replace function add_delivery_platform(p_name text, p_code text default null, p_names jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_name text := nullif(btrim(p_name), '');
  v_code text := lower(nullif(btrim(p_code), ''));
  v_names jsonb := platform_names(p_names);
  v_id uuid; v_n int := 0;
begin
  if v_name is null or length(v_name) > 60 then
    raise exception 'Name the platform as its customers know it, in up to 60 letters';
  end if;
  perform pg_advisory_xact_lock(hashtext('delivery_platform:' || v_business::text));
  if exists (select 1 from delivery_platform where business_id = v_business and lower(name) = lower(v_name)) then
    raise exception '% is already a delivery platform here: bring it back into use instead of adding it again', v_name;
  end if;
  if v_code is null then
    -- From the name when it is written in Latin letters; else platform_1, platform_2 …
    v_code := left(btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '_', 'g'), '_'), 30);
    if v_code !~ '^[a-z][a-z0-9_]{1,29}$' then
      loop
        v_n := v_n + 1;
        v_code := 'platform_' || v_n;
        exit when not exists (select 1 from delivery_platform where business_id = v_business and code = v_code);
      end loop;
    end if;
  end if;
  if v_code !~ '^[a-z][a-z0-9_]{1,29}$' then
    raise exception 'A platform''s short name is small Latin letters, digits and _, starting with a letter (lezzoo)';
  end if;
  if v_code in ('dine_in', 'takeaway', 'direct_delivery') then
    raise exception '% is one of the shop''s own ways of selling, not a platform', v_code;
  end if;
  if exists (select 1 from delivery_platform where business_id = v_business and code = v_code) then
    raise exception 'A platform here already has the short name %: bring it back into use, or choose another', v_code;
  end if;
  execute format('alter type sales_channel add value if not exists %L', v_code);
  insert into delivery_platform (business_id, code, name, names, sort_order)
  values (v_business, v_code, v_name, v_names,
          coalesce((select max(sort_order) from delivery_platform where business_id = v_business), 0) + 1)
  returning id into v_id;
  perform audit_event(v_business, 'platform.create', 'delivery_platform', v_id::text, null, null,
    jsonb_build_object('platform_code', v_code, 'name', v_name, 'names', v_names));
  return jsonb_build_object('id', v_id, 'code', v_code, 'name', v_name);
end $$;

-- The new platform takes its orders' packaging, and optionally its prices,
-- from a channel it works like: each recipe line gated to that channel is
-- gated to the platform too, and each product priced there today is priced
-- the same on the platform, from today. A later call than the one that added
-- the platform: its code is usable once that call is committed.
create or replace function copy_platform_setup(p_platform text, p_like text, p_prices boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_to delivery_platform; v_like text := lower(btrim(p_like)); v_like_name text;
  v_today date; v_lines int; v_prices int := 0;
begin
  select * into v_to from delivery_platform where business_id = v_business and code = lower(btrim(p_platform));
  if not found then raise exception 'Choose one of the café''s delivery platforms'; end if;
  if not v_to.is_active then raise exception '% is not in use: bring it back first', v_to.name; end if;
  if v_like is null or v_like = v_to.code then raise exception 'Choose a channel % works like', v_to.name; end if;
  v_like_name := case v_like when 'dine_in' then 'Dine-in' when 'takeaway' then 'Takeaway'
                             when 'direct_delivery' then 'Direct delivery'
                             else (select name from delivery_platform where business_id = v_business and code = v_like) end;
  if v_like_name is null then raise exception 'Choose a channel % works like', v_to.name; end if;
  v_today := business_local_date(v_business, now());

  update recipe_line rl
     set applies_to_channels = array_append(rl.applies_to_channels, v_to.code::sales_channel)
    from recipe_version rv join recipe r on r.id = rv.recipe_id
   where rl.recipe_version_id = rv.id and r.business_id = v_business
     and rl.applies_to_channels is not null
     and v_like::sales_channel = any (rl.applies_to_channels)
     and not (v_to.code::sales_channel = any (rl.applies_to_channels));
  get diagnostics v_lines = row_count;

  if p_prices then
    perform set_config('audit.reason', format('Priced as on %s when %s was added', v_like_name, v_to.name), true);
    insert into channel_price (business_id, product_variant_id, channel, price, effective_from)
    select v_business, pv.id, v_to.code::sales_channel, x.price, v_today
      from product_variant pv
      cross join lateral (select price_on(pv.id, v_like::sales_channel, null, v_today) as price) x
     where pv.business_id = v_business and pv.is_active and x.price is not null
       and price_on(pv.id, v_to.code::sales_channel, null, v_today) is null;
    get diagnostics v_prices = row_count;
    perform set_config('audit.reason', '', true);
  end if;

  if v_lines + v_prices > 0 then
    perform audit_event(v_business, 'platform.setup', 'delivery_platform', v_to.id::text, null, null,
      jsonb_build_object('platform_code', v_to.code, 'name', v_to.name, 'set_up_like', v_like_name,
                         'packaging_lines', v_lines, 'prices_copied', v_prices));
  end if;
  return jsonb_build_object('lines', v_lines, 'prices', v_prices);
end $$;

-- Renamed, named in other languages, taken out of use or brought back.
create or replace function update_delivery_platform(p_platform text, p_name text, p_names jsonb, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_old delivery_platform; v_name text := nullif(btrim(p_name), ''); v_names jsonb := platform_names(p_names);
begin
  select * into v_old from delivery_platform where business_id = v_business and code = lower(btrim(p_platform)) for update;
  if not found then raise exception 'Choose one of the café''s delivery platforms'; end if;
  if v_name is null or length(v_name) > 60 then
    raise exception 'Name the platform as its customers know it, in up to 60 letters';
  end if;
  if exists (select 1 from delivery_platform where business_id = v_business and id <> v_old.id
                                              and lower(name) = lower(v_name)) then
    raise exception '% is already a delivery platform here', v_name;
  end if;
  update delivery_platform set name = v_name, names = v_names, is_active = coalesce(p_active, is_active)
   where id = v_old.id;
  if v_old.name is distinct from v_name or v_old.names is distinct from v_names
     or v_old.is_active is distinct from coalesce(p_active, v_old.is_active) then
    perform audit_event(v_business, 'platform.update', 'delivery_platform', v_old.id::text, null,
      jsonb_build_object('platform_code', v_old.code, 'name', v_old.name, 'names', v_old.names,
                         'is_active', v_old.is_active),
      jsonb_build_object('platform_code', v_old.code, 'name', v_name, 'names', v_names,
                         'is_active', coalesce(p_active, v_old.is_active)));
  end if;
end $$;

-- =============================================================================
-- 4. What the platforms owe: every platform, in use or not, with its names
-- =============================================================================
create or replace function platform_money() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); v_waiting numeric; v_bal numeric; v_today date;
begin
  v_today := business_local_date(v_business, now());
  select coalesce(sum(o.net_amount), 0) into v_waiting
    from platform_order po join sales_order o on o.id = po.sales_order_id
   where po.business_id = v_business and po.settlement_id is null and o.status not in ('voided', 'refunded');
  v_bal := gl_balance_at(v_business, '1100', 'infinity');
  return jsonb_build_object(
    'platforms', coalesce((
      select jsonb_agg(jsonb_build_object('code', dp.code, 'name', dp.name, 'names', dp.names, 'active', dp.is_active,
                                          'waiting', (select count(*) from platform_order po join sales_order o on o.id = po.sales_order_id
                                                       where po.platform_id = dp.id and po.settlement_id is null
                                                         and o.status not in ('voided', 'refunded')),
                                          -- What the till could sell on it today: products on the menu with a price there.
                                          'priced', (select count(distinct cp.product_variant_id)
                                                       from channel_price cp
                                                       join product_variant pv on pv.id = cp.product_variant_id
                                                       join product p on p.id = pv.product_id
                                                      where cp.business_id = v_business and cp.channel::text = dp.code
                                                        and pv.is_active and p.is_active and cp.effective_from <= v_today
                                                        and (cp.effective_to is null or cp.effective_to >= v_today)))
                       order by dp.sort_order, dp.name)
        from delivery_platform dp where dp.business_id = v_business), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object('platform', dp.code, 'order_no', po.external_order_id, 'sale_id', o.id,
                                          'placed_at', o.placed_at, 'amount', o.net_amount,
                                          'days', v_today - business_local_date(v_business, o.placed_at))
                       order by o.placed_at)
        from platform_order po join delivery_platform dp on dp.id = po.platform_id
        join sales_order o on o.id = po.sales_order_id
       where po.business_id = v_business and po.settlement_id is null and o.status not in ('voided', 'refunded')), '[]'::jsonb),
    'waiting', v_waiting, 'receivable', v_bal, 'unmatched', v_bal - v_waiting,
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'platform', dp.code, 'reference', s.reference, 'received_on', s.received_on,
               'period_start', s.period_start, 'period_end', s.period_end,
               'orders', (select count(*) from platform_settlement_line sl where sl.settlement_id = s.id and sl.status = 'matched'),
               'lines', (select count(*) from platform_settlement_line sl where sl.settlement_id = s.id),
               'payout', (select coalesce(sum(sl.reported_payout), 0) from platform_settlement_line sl
                           where sl.settlement_id = s.id and sl.status = 'matched'),
               'statement_total', s.statement_total, 'note', s.note,
               'journal_no', (select journal_no from journal_entry where id = s.journal_entry_id),
               'by', u.full_name, 'at', s.imported_at, 'cancelled_at', s.cancelled_at, 'cancel_reason', s.cancel_reason)
             order by s.imported_at desc)
        from (select * from platform_settlement where business_id = v_business order by imported_at desc limit 30) s
        join delivery_platform dp on dp.id = s.platform_id
        left join app_user u on u.id = s.created_by), '[]'::jsonb));
end $$;

-- 0030's record_sale: a platform taken out of use sells nothing more, and each
-- message names the platform as the café named it.
create or replace function record_sale(
  p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type, p_lines jsonb,
  p_location uuid default null, p_discount_percent numeric default null, p_discount_amount numeric default null,
  p_expected_net numeric default null, p_discount_reason text default null, p_discount_note text default null,
  p_approval uuid default null, p_platform_order_no text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create'); r jsonb;
  v_no text := nullif(trim(p_platform_order_no), ''); v_platform uuid; v_at timestamptz;
  v_pname text; v_active boolean;
begin
  if (p_discount_percent is not null or p_discount_amount is not null)
     and not current_has_permission('discount.apply') then
    raise exception 'You do not have permission to give discounts' using errcode = '42501';
  end if;
  -- A platform sale goes through one of the café's platforms, in use; a sale
  -- it already recorded, sent again by a till that was offline, is replayed.
  if is_platform_channel(p_channel) then
    select id, name, is_active into v_platform, v_pname, v_active
      from delivery_platform where business_id = v_business and code = p_channel::text;
    if not exists (select 1 from sales_order where business_id = v_business and idempotency_key = p_idempotency_key) then
      if v_platform is null then
        raise exception '% is not one of the café''s delivery platforms: add it on Delivery Platforms', initcap(p_channel::text);
      end if;
      if not v_active then
        raise exception '% is no longer in use: bring it back on Delivery Platforms to sell through it', v_pname;
      end if;
    end if;
  end if;
  r := post_sale(v_business, (current_member()).id, p_idempotency_key, p_channel, p_tender, p_lines,
                 p_location, p_discount_percent, p_discount_amount, false,
                 jsonb_build_object('reason', p_discount_reason, 'note', p_discount_note, 'approval', p_approval));
  perform assert_sale_total(r, p_expected_net);
  -- A replay is the sale already recorded, with its number.
  if is_platform_channel(p_channel) and not coalesce((r ->> 'replayed')::boolean, false) then
    if v_no is null then
      raise exception 'Enter the % order number', v_pname;
    end if;
    if length(v_no) > 40 or v_no !~ '^[A-Za-z0-9#/_.-]+$' then
      raise exception 'An order number is letters and digits, as the % tablet shows it', v_pname;
    end if;
    select o.placed_at into v_at
      from platform_order po join sales_order o on o.id = po.sales_order_id
     where po.business_id = v_business and po.platform_id = v_platform and lower(po.external_order_id) = lower(v_no);
    if found then
      raise exception '% order % is already recorded, on the sale of %', v_pname, v_no,
        to_char(v_at at time zone (select timezone from business where id = v_business), 'DD Mon HH24:MI');
    end if;
    insert into platform_order (business_id, platform_id, location_id, external_order_id, status, store_list_value,
                                customer_payment, sales_order_id, placed_at, import_source)
    select v_business, v_platform, o.location_id, v_no, 'completed', o.gross_amount, o.net_amount, o.id, o.placed_at, 'till'
      from sales_order o where o.id = (r ->> 'order_id')::uuid;
    r := r || jsonb_build_object('platform_order_no', v_no);
  end if;
  return r;
end $$;

-- =============================================================================
-- 5. The alerts: no margin or price alerts for a platform taken out of use
-- =============================================================================
create or replace function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language plpgsql stable set search_path = public as $$
declare
  v_tz text; v_today date; v_loc uuid;
  v_use_types movement_type[] := array['sale_consumption', 'production_consumption', 'waste', 'spoilage',
    'melt_evaporation', 'staff_consumption', 'complimentary', 'sampling', 'damaged', 'expired']::movement_type[];
  v_lead numeric := alert_setting(p_business, 'lead_time_days');
  v_target numeric := alert_setting(p_business, 'margin_target_percent');
  v_running uuid[] := '{}';
  v_seen text[] := '{}';
  v_costs jsonb;                                       -- item id -> its cost now, and whether it is a fallback
  v_nocost jsonb := '{}';                              -- item id -> the products that use it
  r record; v_daily numeric; v_cost numeric; v_n int; v_zero uuid[]; v_fallback boolean; v_broken boolean;
  v_item uuid; v_pname text;
begin
  select timezone into v_tz from business where id = p_business;
  v_today := business_local_date(p_business, p_now);
  v_loc := default_location(p_business);

  -- Cash below zero: a till, safe or bank balance under nothing.
  return query
    select 'cash_negative'::text, a.code::text, 'red'::text,
           format('%s is %s IQD: below zero', a.name, alert_money(a.bal)),
           'Money cannot leave a place before it is there: a payment was recorded from the wrong place, or takings are missing.'::text,
           'Open the account''s journal lines and record where the money really came from.'::text,
           'high'::text, '/journals?account=' || a.code,
           jsonb_build_object('account', a.code, 'balance', a.bal)
      from (select g.code, g.name, gl_balance_at(p_business, g.code, 'infinity') as bal
              from gl_account g
             where g.business_id = p_business and g.code in ('1000', '1005', '1020')) a
     where a.bal < 0;

  -- A drawer not counted: days before today whose cash no count has covered.
  return query
    select 'drawer_uncounted'::text, u.location_id::text,
           case when count(*) >= 2 then 'red' else 'orange' end::text,
           case when count(*) = 1
                then format('The drawer at %s has not been counted for %s', l.name, to_char(min(u.day), 'DD Mon'))
                else format('The drawer at %s has not been counted for %s days, since %s', l.name, count(*),
                            to_char(min(u.day), 'DD Mon')) end,
           'Until the drawer is counted, nobody knows whether the cash is all there.'::text,
           'Count the drawer on Sales.'::text, 'high'::text, '/sales'::text,
           jsonb_build_object('days', jsonb_agg(u.day order by u.day))
      from uncounted_days(p_business) u join location l on l.id = u.location_id
     where u.day < v_today
     group by u.location_id, l.name;

  -- A stock count left open.
  return query
    select 'count_stale'::text, c.id::text, 'orange'::text,
           format('A stock count has been open since %s', to_char(c.started_at at time zone v_tz, 'DD Mon HH24:MI')),
           'An open count is not in the books yet, and the longer it stays open the harder it is to finish honestly.'::text,
           'Finish it, or cancel it, on Stock Count.'::text, 'high'::text, '/count'::text,
           jsonb_build_object('count_id', c.id, 'status', c.status, 'started_at', c.started_at)
      from stock_count c
     where c.business_id = p_business and c.status in ('draft', 'counting', 'submitted')
       and c.started_at < p_now - make_interval(hours => alert_setting(p_business, 'count_stale_hours')::int);

  -- Running out: days of cover (on hand ÷ average daily use over the last 14
  -- days) under the time a delivery takes plus a day — the item's last
  -- supplier's own, or the café's. Quiet with under 7 days of history, and on
  -- a day the item was received.
  for r in
    with hist as (
      select m.item_id, min(business_local_date(p_business, m.occurred_at)) as first_day,
             -sum(m.base_quantity_signed) filter (
                where m.occurred_at >= p_now - interval '14 days'
                  and (m.type = any (v_use_types) or m.type = 'refund_return_to_stock'
                       or (m.type = 'reversal' and m.reference_type = 'sale_void')
                       or (m.type = 'reversal' and m.reference_type = 'production_cancel' and m.base_quantity_signed > 0)))
               as used,
             bool_or(m.type = 'purchase_receipt' and business_local_date(p_business, m.occurred_at) = v_today) as received_today
        from inventory_movement m
       where m.business_id = p_business
       group by m.item_id
    ),
    onhand as (
      select cs.item_id, sum(cs.quantity_base) as qty from current_stock cs where cs.business_id = p_business group by 1
    ),
    supplied as (
      select distinct on (m.item_id) m.item_id, s.lead_time_days
        from inventory_movement m
        join goods_receipt g on g.id = m.reference_id
        join supplier s on s.id = g.supplier_id
       where m.business_id = p_business and m.type = 'purchase_receipt' and m.reference_type = 'goods_receipt'
       order by m.item_id, m.occurred_at desc, m.created_at desc
    )
    select i.id, i.name, i.base_unit_code, coalesce(o.qty, 0) as qty, h.used,
           least(14, v_today - h.first_day) as window_days, v_today - h.first_day as history_days, h.received_today,
           coalesce(sp.lead_time_days, v_lead) as lead,
           exists (select 1 from recipe rc where rc.output_item_id = i.id and rc.is_active) as made
      from item i join hist h on h.item_id = i.id
      left join onhand o on o.item_id = i.id
      left join supplied sp on sp.item_id = i.id
     where i.business_id = p_business and i.is_active
  loop
    continue when r.history_days < 7 or r.received_today or coalesce(r.used, 0) <= 0;
    v_daily := r.used / r.window_days;                  -- average use a day
    continue when r.qty / v_daily >= r.lead + 1;
    v_running := v_running || r.id;
    rule := 'running_out'; subject := r.id::text;
    urgency := case when r.qty / v_daily < 1 then 'red' else 'orange' end;
    title := format('%s runs out in %s: %s %s left, using about %s a day', r.name,
                    case when r.qty <= 0 then 'no time' when r.qty / v_daily < 1 then 'under a day'
                         else trim_scale(round(r.qty / v_daily, 1)) || ' days' end,
                    alert_qty(r.qty), r.base_unit_code, alert_qty(v_daily));
    why := 'What is sold without stock is costed wrongly, and customers are turned away.';
    action := case when r.made then 'Make a batch on Production.'
                   else format('Order about %s %s (a week of use).', alert_qty(ceil(v_daily * 7)), r.base_unit_code) end;
    confidence := case when r.history_days >= 28 then 'high' when r.history_days >= 14 then 'medium' else 'low' end;
    link := '/inventory/' || r.id;
    facts := jsonb_build_object('on_hand', r.qty, 'daily_use', round(v_daily, 4), 'history_days', r.history_days,
                                'lead_time_days', r.lead);
    return next;
  end loop;

  -- Below its reorder level, items never moved included (unless running out says it already).
  return query
    select 'below_minimum'::text, i.id::text, 'orange'::text,
           format('%s: %s %s on hand, below its reorder level of %s', i.name, alert_qty(coalesce(o.qty, 0)),
                  i.base_unit_code, alert_qty(i.min_level_base)),
           'Below the reorder level there may not be enough until the next delivery.'::text,
           case when exists (select 1 from recipe rc where rc.output_item_id = i.id and rc.is_active)
                then 'Make a batch on Production.' else 'Order it.' end,
           'high'::text, '/inventory/' || i.id,
           jsonb_build_object('on_hand', coalesce(o.qty, 0), 'min_level', i.min_level_base)
      from item i
      left join (select cs.item_id, sum(cs.quantity_base) as qty from current_stock cs
                  where cs.business_id = p_business group by 1) o on o.item_id = i.id
     where i.business_id = p_business and i.is_active and i.min_level_base > 0
       and coalesce(o.qty, 0) < i.min_level_base and not (i.id = any (v_running));

  -- A delivery price far from the cost now, confirmed in the last week (0027).
  return query
    select 'price_confirmed'::text, a.id::text, 'orange'::text,
           coalesce(a.reason, 'A delivery price was confirmed') || coalesce(' — confirmed by ' || u.full_name, ''),
           'A price typed wrongly changes the cost of everything made from the item until it is corrected.'::text,
           'Check it against the supplier''s invoice.'::text, 'high'::text, '/purchasing'::text,
           jsonb_build_object('receipt_id', a.entity_id, 'confirmed_at', a.occurred_at)
      from audit_log a left join app_user u on u.id = a.app_user_id
     where a.business_id = p_business and a.action = 'purchase.price_confirmed'
       and a.occurred_at >= p_now - interval '7 days';

  -- Margins: sold below cost (red), or under the target margin (orange); a
  -- product sold with no recipe; and an ingredient with no cost yet, named
  -- once with the products that use it. Every item is costed once, as a sale
  -- would take it off the shelf now; a cost from the last delivery, for an
  -- item with none on hand, makes the margin less sure.
  select coalesce(jsonb_object_agg(i.id, jsonb_build_object(
           'c', item_issue_cost(p_business, i.id, v_loc), 'f', not (p.qty > 0 and p.value > 0))), '{}')
    into v_costs
    from item i cross join lateral item_position(p_business, i.id, v_loc) p
   where i.business_id = p_business;
  for r in
    select pv.id as vid, p.name as pname, pv.name as vname, ch, price_on(pv.id, ch, v_loc, v_today) as price
      from product_variant pv join product p on p.id = pv.product_id
      cross join unnest(enum_range(null::sales_channel)) ch
     where pv.business_id = p_business and pv.is_active and p.is_active and pv.no_stock_reason is null
       and channel_in_use(p_business, ch)
  loop
    continue when r.price is null or r.price <= 0;
    v_pname := r.pname || case when r.vname <> r.pname then ' — ' || r.vname else '' end;
    v_broken := false;
    begin
      select count(*), coalesce(sum(money_round(p_business, (v_costs -> e.item_id::text ->> 'c')::numeric * e.base_qty)), 0),
             coalesce(array_agg(e.item_id) filter (
               where coalesce((v_costs -> e.item_id::text ->> 'c')::numeric, 0) <= 0 and e.base_qty > 0), '{}'),
             coalesce(bool_or((v_costs -> e.item_id::text ->> 'f')::boolean), false)
        into v_n, v_cost, v_zero, v_fallback
        from expand_variant(r.vid, r.ch, 1, v_today) e;
    exception when others then
      v_n := 0; v_broken := true;                      -- its recipe cannot be read today
    end;
    if v_n = 0 then
      subject := r.vid::text;
      continue when subject = any (v_seen);            -- once, whichever channels it is sold on
      v_seen := v_seen || subject;
      rule := 'no_recipe'; urgency := 'orange'; confidence := 'high'; link := '/products';
      title := case when v_broken then format('%s cannot be sold: its recipe has no version in force today', v_pname)
                    else format('%s is sold with no recipe: its sales are costed at nothing', v_pname) end;
      why := 'A sale costed at nothing overstates the profit, and its stock is never taken off the shelf.';
      action := 'Give it its recipe on Products, or say why it uses no stock.';
      facts := jsonb_build_object('variant_id', r.vid);
      return next;
      continue;
    end if;
    if cardinality(v_zero) > 0 then
      foreach v_item in array v_zero loop
        if not coalesce(v_nocost -> v_item::text, '[]'::jsonb) ? v_pname then
          v_nocost := jsonb_set(v_nocost, array[v_item::text],
                                coalesce(v_nocost -> v_item::text, '[]'::jsonb) || to_jsonb(v_pname));
        end if;
      end loop;
      continue;                                        -- its margin waits for every ingredient's cost
    end if;
    if r.price < v_cost or (r.price - v_cost) / r.price * 100 < v_target then
      rule := 'margin'; subject := r.vid || ':' || r.ch;
      urgency := case when r.price < v_cost then 'red' else 'orange' end;
      title := format('%s (%s): %s at %s IQD, costing %s', v_pname, alert_channel(p_business, r.ch),
                      case when r.price < v_cost then 'sold below cost'
                           else trim_scale(trunc((r.price - v_cost) / r.price * 100, 1)) || '% margin' end,
                      alert_money(r.price), alert_money(v_cost));
      why := case when r.price < v_cost then 'Every one sold loses money.'
                  else format('Under the %s%% target, the price no longer covers what the recipe costs now.', trim_scale(v_target)) end;
      action := 'Review the price, or the recipe, on Products.';
      confidence := case when v_fallback then 'medium' else 'high' end;
      link := '/products';
      facts := jsonb_build_object('variant_id', r.vid, 'channel', r.ch, 'price', r.price, 'cost', v_cost,
                                  'target_percent', v_target, 'cost_from_last_delivery', v_fallback);
      return next;
    end if;
  end loop;

  return query
    select 'no_cost'::text, i.id::text, 'orange'::text,
           format('%s has no cost yet, and %s use%s it: %s', i.name,
                  case when jsonb_array_length(x.v) = 1 then '1 product' else jsonb_array_length(x.v) || ' products' end,
                  case when jsonb_array_length(x.v) = 1 then 's' else '' end,
                  (select string_agg(n, ', ' order by n) from (select jsonb_array_elements_text(x.v) n order by 1 limit 4) q)
                  || case when jsonb_array_length(x.v) > 4 then format(' and %s more', jsonb_array_length(x.v) - 4) else '' end),
           'Every sale that uses it is costed at nothing for it, so its profit is overstated.'::text,
           case when exists (select 1 from recipe rc where rc.output_item_id = i.id and rc.is_active)
                then 'Make a batch on Production: its cost comes from its ingredients.'
                else 'Receive it with its cost, or give it its opening stock, on Inventory.' end,
           'high'::text, '/inventory/' || i.id,
           jsonb_build_object('item_id', i.id, 'products', x.v)
      from jsonb_each(v_nocost) x(k, v) join item i on i.id = x.k::uuid;

  -- Waste well above its usual: the last 7 days against the weeks before.
  return query
    with w as (
      select coalesce(sum(l.debit - l.credit) filter (where e.occurred_at >= p_now - interval '7 days'), 0) as last7,
             coalesce(sum(l.debit - l.credit) filter (where e.occurred_at < p_now - interval '7 days'
                                                        and e.occurred_at >= p_now - interval '35 days'), 0) as prior,
             (select v_today - min(business_local_date(p_business, e2.occurred_at))
                from journal_entry e2 where e2.business_id = p_business and e2.status = 'published') as history_days
        from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id
       where e.business_id = p_business and e.status = 'published' and g.code = '5300'
         and e.occurred_at >= p_now - interval '35 days' and e.occurred_at < p_now
    ), x as (
      select w.*, least(28, w.history_days - 7) as prior_days from w
    )
    select 'waste_spike'::text, 'waste'::text, 'orange'::text,
           format('Waste of %s IQD in the last 7 days, against about %s in a usual week', alert_money(x.last7),
                  alert_money(x.prior / x.prior_days * 7)),
           'Waste well above its usual is money leaving through the bin: a delivery gone off, a recipe, or a habit.'::text,
           'Look at the waste on Inventory: which items, and who recorded them.'::text,
           (case when x.prior_days >= 28 then 'medium' else 'low' end)::text, '/inventory'::text,
           jsonb_build_object('last7', x.last7, 'usual_week', round(x.prior / x.prior_days * 7), 'prior_days', x.prior_days)
      from x
     where x.prior_days >= 7 and x.prior > 0
       and x.last7 > alert_setting(p_business, 'waste_spike_factor') * (x.prior / x.prior_days * 7)
       and x.last7 > alert_setting(p_business, 'waste_spike_min');

  -- One person's voids, refunds, discounts and cancelled bills in the last 7
  -- days: more than a share of their own sales, or more than a set number.
  return query
    with ex as (
      select sa.requested_by as person, sa.amount, 1 as n
        from sale_adjustment sa
       where sa.business_id = p_business and sa.kind in ('void', 'refund') and sa.created_at >= p_now - interval '7 days'
      union all
      select coalesce(o.discount_by, o.cashier_id), o.discount_amount, 1
        from sales_order o
       where o.business_id = p_business and o.discount_amount > 0 and o.status <> 'open'
         and o.placed_at >= p_now - interval '7 days'
      union all
      select a.app_user_id, 0, 1
        from audit_log a
       where a.business_id = p_business and a.action = 'bill.cancel'
         and jsonb_typeof(a.before_state -> 'lines') = 'array' and a.occurred_at >= p_now - interval '7 days'
    ), per as (
      select ex.person, sum(ex.amount) as amount, sum(ex.n) as n,
             (select coalesce(sum(o.gross_amount), 0) from sales_order o
               where o.business_id = p_business and o.cashier_id = ex.person and o.status <> 'open'
                 and o.placed_at >= p_now - interval '7 days') as own_sales
        from ex where ex.person is not null group by ex.person
    )
    select 'exceptions_person'::text, per.person::text, 'orange'::text,
           format('%s: %s void(s), refund(s), discount(s) or cancelled bill(s) in 7 days, %s IQD%s', u.full_name, per.n,
                  alert_money(per.amount),
                  case when per.own_sales > 0 then format(' (%s%% of their sales)', trim_scale(round(per.amount / per.own_sales * 100, 1)))
                       else '' end),
           'Most exceptions have good reasons; a pattern is worth a look. This is evidence, not an accusation.'::text,
           'Review them on Reports → Exceptions.'::text, 'medium'::text, '/reports#exceptions'::text,
           jsonb_build_object('count', per.n, 'amount', per.amount, 'own_sales', per.own_sales)
      from per join app_user u on u.id = per.person
     where per.n >= alert_setting(p_business, 'exceptions_count')
        or (per.own_sales > 0 and per.amount > 0
            and per.amount / per.own_sales * 100 > alert_setting(p_business, 'exceptions_share_percent'));

  -- Card money not banked: what 1010 holds beyond the takings of the last few
  -- days (a settlement clears the oldest first).
  return query
    select 'card_not_banked'::text, '1010'::text, 'orange'::text,
           format('%s IQD of card money is more than %s days old and not yet recorded as settled', alert_money(c.old), c.days),
           'Card takings should reach the bank within a few days; money that does not may never have been taken.'::text,
           'Record the card settlement on Sales, from the terminal''s report and the bank statement.'::text,
           'high'::text, '/sales#card'::text,
           jsonb_build_object('balance', c.bal, 'older_than_days', c.days, 'amount', c.old)
      from (select t.days, t.bal,
                   t.bal - coalesce((select sum(l.debit) from journal_line l
                                       join journal_entry e on e.id = l.journal_entry_id
                                       join gl_account g on g.id = l.account_id
                                      where e.business_id = p_business and e.status = 'published' and g.code = '1010'
                                        and e.occurred_at >= p_now - make_interval(days => t.days)), 0) as old
              from (select alert_setting(p_business, 'card_days')::int as days,
                           gl_balance_at(p_business, '1010', 'infinity') as bal) t) c
     where c.old > 0;

  -- Platform money not received: orders not paid out past the platform's
  -- cycle, by order number (0030); and what platform receivable holds that
  -- no order explains (sales from before order numbers, or a payout
  -- recorded by hand).
  return query
    select 'platform_not_received'::text, dp.code, 'orange'::text,
           format('%s %s order%s, %s IQD, %s more than %s days old and not yet paid out; the oldest from %s',
                  count(*), dp.name, case when count(*) = 1 then '' else 's' end, alert_money(sum(o.net_amount)),
                  case when count(*) = 1 then 'is' else 'are' end, alert_setting(p_business, 'platform_days')::int,
                  to_char(min(o.placed_at) at time zone v_tz, 'DD Mon')),
           'Platform payouts come on a cycle; an order past it may be missing from a statement.'::text,
           'Match the platform''s statement on Delivery Platforms, and raise any order it left out.'::text,
           'high'::text, '/platforms'::text,
           jsonb_build_object('orders', count(*), 'amount', sum(o.net_amount), 'oldest', min(o.placed_at))
      from platform_order po
      join delivery_platform dp on dp.id = po.platform_id
      join sales_order o on o.id = po.sales_order_id
     where po.business_id = p_business and po.settlement_id is null and o.status not in ('voided', 'refunded')
       and o.placed_at < p_now - make_interval(days => alert_setting(p_business, 'platform_days')::int)
     group by dp.code, dp.name;
  return query
    select 'platform_not_received'::text, 'unmatched'::text, 'orange'::text,
           case when x.gap > 0
                then format('%s IQD in platform receivable is matched to no order', alert_money(x.gap))
                else format('Platform receivable is %s IQD short of the orders waiting to be paid out', alert_money(-x.gap)) end,
           'Sales from before order numbers, or a payout recorded by hand, leave platform receivable unexplained by any order.'::text,
           'Find the statement it belongs to; correct it with a journal on Journals if it was recorded by hand.'::text,
           'medium'::text, '/journals?account=1100'::text,
           jsonb_build_object('receivable', x.bal, 'orders_waiting', x.waiting, 'gap', x.gap)
      from (select b.bal, b.waiting, b.bal - b.waiting as gap
              from (select gl_balance_at(p_business, '1100', 'infinity') as bal,
                           coalesce((select sum(o.net_amount) from platform_order po
                                       join sales_order o on o.id = po.sales_order_id
                                      where po.business_id = p_business and po.settlement_id is null
                                        and o.status not in ('voided', 'refunded')), 0) as waiting) b) x
     where x.gap <> 0;

  -- Supplier bills due within a few days, or overdue.
  return query
    select 'bill_due'::text, pi.id::text, 'orange'::text,
           format('%s: %s IQD %s', coalesce(s.name, 'A supplier'), alert_money(pi.amount_total - pi.paid_amount),
                  case when pi.due_date < v_today then format('overdue by %s day(s)', v_today - pi.due_date)
                       when pi.due_date = v_today then 'due today'
                       else format('due on %s', to_char(pi.due_date, 'DD Mon')) end),
           'Bills paid late cost goodwill, and sometimes a late fee.'::text,
           'Pay it, or agree a date with the supplier, on Vendors.'::text, 'high'::text, '/vendors'::text,
           jsonb_build_object('bill_id', pi.id, 'invoice_no', pi.invoice_no, 'due_date', pi.due_date,
                              'owed', pi.amount_total - pi.paid_amount)
      from purchase_invoice pi left join supplier s on s.id = pi.supplier_id
     where pi.business_id = p_business and pi.cancelled_at is null and pi.amount_total - pi.paid_amount > 0
       and pi.due_date is not null and pi.due_date <= v_today + alert_setting(p_business, 'bill_due_days')::int;

  -- A price that looks typed wrongly: one channel more than 3× another.
  return query
    with pr as (
      select pv.id as vid, p.name || case when pv.name <> p.name then ' — ' || pv.name else '' end as pname,
             ch, price_on(pv.id, ch, v_loc, v_today) as price
        from product_variant pv join product p on p.id = pv.product_id
        cross join unnest(enum_range(null::sales_channel)) ch
       where pv.business_id = p_business and pv.is_active and p.is_active
         and channel_in_use(p_business, ch)
    ), mm as (
      select vid, pname, max(price) as hi, min(price) as lo,
             (array_agg(ch order by price desc, ch))[1] as hi_ch, (array_agg(ch order by price, ch))[1] as lo_ch
        from pr where price > 0 group by vid, pname having count(*) >= 2
    )
    select 'price_typo'::text, mm.vid::text, 'orange'::text,
           format('%s is %s IQD on %s but %s on %s', mm.pname, alert_money(mm.hi), alert_channel(p_business, mm.hi_ch),
                  alert_money(mm.lo), alert_channel(p_business, mm.lo_ch)),
           'A price more than three times another channel''s is usually a missing or extra zero.'::text,
           'Confirm it on Products.'::text, 'medium'::text, '/products'::text,
           jsonb_build_object('variant_id', mm.vid, 'high', mm.hi, 'low', mm.lo)
      from mm
     where mm.hi > alert_setting(p_business, 'price_typo_factor') * mm.lo;

  -- A payment that may have been recorded twice: two expenses, bills or
  -- journals to the same running-cost account, for the same amount, within 3 days.
  return query
    with pay as (
      select e.id, e.journal_no, e.occurred_at, g.code, g.name as account, l.debit as amount
        from journal_line l join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id
       where e.business_id = p_business and e.status = 'published' and e.reverses_entry is null
         and not exists (select 1 from journal_entry rv where rv.reverses_entry = e.id and rv.status = 'published')
         and e.reference_type in ('manual', 'expense', 'purchase_invoice', 'correction')
         and g.code like '6%' and l.debit > 0 and e.occurred_at >= p_now - interval '30 days'
    )
    select 'duplicate_payment'::text, a.id::text || ':' || b.id::text, 'orange'::text,
           format('Possible duplicate: %s %s IQD in journal %s (%s) and journal %s (%s)', a.account, alert_money(a.amount),
                  a.journal_no, to_char(a.occurred_at at time zone v_tz, 'DD Mon'),
                  b.journal_no, to_char(b.occurred_at at time zone v_tz, 'DD Mon')),
           'The same amount to the same account twice in a few days is sometimes paid twice.'::text,
           'Confirm both are right, or reverse one on Journals.'::text, 'medium'::text,
           '/journals?account=' || a.code,
           jsonb_build_object('entries', jsonb_build_array(a.journal_no, b.journal_no), 'amount', a.amount)
      from pay a join pay b on b.code = a.code and b.amount = a.amount and a.journal_no < b.journal_no
                           and abs(extract(epoch from b.occurred_at - a.occurred_at)) <= 3 * 86400;
end $$;

-- =============================================================================
-- 6. Who may call what
-- =============================================================================
drop function if exists alert_channel(sales_channel);
drop function if exists platform_id_for(uuid, sales_channel);   -- a sale now finds its platform, or is refused
revoke execute on function
  channel_in_use(uuid, sales_channel), platform_names(jsonb), alert_channel(uuid, sales_channel)
  from public, anon, authenticated;
revoke execute on function
  sales_channels(), add_delivery_platform(text, text, jsonb), copy_platform_setup(text, text, boolean),
  update_delivery_platform(text, text, jsonb, boolean)
  from public, anon;
grant execute on function
  sales_channels(), add_delivery_platform(text, text, jsonb), copy_platform_setup(text, text, boolean),
  update_delivery_platform(text, text, jsonb, boolean)
  to authenticated;
