-- =============================================================================
-- The simulated year (SMART_PLAN step 7): the café made ready on the copy, and
-- the habits each day leans on. Run as the database's superuser, on the copy
-- only (sixties_sim, on the clock-controlled server: scripts/sim/run.sh).
--
--  * sim.at(local time): the server's clock moved to that moment in Erbil.
--  * The staff, their logins, their pay; the suppliers, their prices and how
--    long they take; the café's opening money.
--  * sim.planted: the answer key — the problems planted in the year, who,
--    from and until when — read by the backtests (scripts/sim/backtest.py).
--  * Helpers a day leans on: reorder from a supplier, make the gelato and the
--    croissants, close a drawer (short, when planted), bank the safe, pay the
--    bills that are due, throw away what is left. Each calls the café's own
--    functions as the person acting, so the books are as the app keeps them.
-- =============================================================================
create schema if not exists sim;
grant usage on schema sim to authenticated;

create table if not exists sim.config (key text primary key, value text not null);

-- The answer key: what was planted, so a feature's warnings can be scored.
create table if not exists sim.planted (
  id      serial primary key,
  kind    text not null,      -- voids | discounts | drawer_short | new_staff (not a problem)
  who     text not null,      -- the person's name
  starts  date not null,
  ends    date not null,
  problem boolean not null,   -- false: something a good feature must NOT raise
  note    text not null
);

-- What each day did, for the year's summary and to find a day that failed.
create table if not exists sim.day_log (
  day date primary key, sales int, failed int, note text
);

-- The server's clock, moved to a moment in Erbil (UTC+3). The next statement
-- starts at that moment (libfaketime reads the file on every clock call).
create or replace function sim.at(p_local timestamp) returns void
language plpgsql security definer set search_path = public, sim as $$
declare v_file text := (select value from sim.config where key = 'clock_file');
begin
  execute format('copy (select %L) to %L',
    '@' || to_char(p_local at time zone 'Asia/Baghdad' at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
    v_file);
end $$;
grant execute on function sim.at(timestamp) to authenticated;

create or replace function sim.business() returns uuid language sql immutable as
$$ select '00000000-0000-0000-0000-0000000000b1'::uuid $$;
create or replace function sim.main() returns uuid language sql stable as
$$ select id from location where business_id = sim.business() and kind = 'branch' order by created_at limit 1 $$;

-- -----------------------------------------------------------------------------
-- What each supplier sells, at what price per base unit, and how often they come.
-- -----------------------------------------------------------------------------
create table if not exists sim.supply (
  item      text primary key,   -- the item's name
  supplier  text not null,
  price     numeric not null,   -- per base unit (g, ml, each), at the start of the year
  daily     numeric not null    -- a first guess at a day's use, before there is history
);
create table if not exists sim.supplier_plan (
  supplier text primary key,
  every_days int not null,      -- how often they deliver
  cover_days int not null       -- how many days of use each delivery is meant to cover
);
-- Price rises through the year: from that day the supplier charges this much more.
create table if not exists sim.price_rise (
  item text not null, from_day date not null, factor numeric not null,
  primary key (item, from_day)
);

-- Today's price of an item, rises included.
grant select on sim.supply, sim.supplier_plan, sim.price_rise to authenticated;

create or replace function sim.price(p_item text, p_day date) returns numeric
language sql stable as $$
  select round(s.price * coalesce((select exp(sum(ln(r.factor))) from sim.price_rise r
                                     where r.item = s.item and r.from_day <= p_day), 1), 2)
    from sim.supply s where s.item = p_item
$$;

-- A delivery from a supplier, received now by whoever is acting: each of its
-- items brought up to cover its days, from its use over the last 14 days (or
-- the first guess, early on). Then its bill, due in 30 days. Returns the bill.
create or replace function sim.deliver(p_supplier text) returns uuid
language plpgsql security definer set search_path = public, sim as $$
declare
  v_sup uuid := (select id from supplier where business_id = sim.business() and name = p_supplier);
  v_cover int := (select cover_days from sim.supplier_plan where supplier = p_supplier);
  v_day date := business_local_date(sim.business(), now());
  v_lines jsonb := '[]'; r record; v_use numeric; v_have numeric; v_qty numeric; v_res jsonb;
begin
  for r in select s.item, s.daily, i.id, i.base_unit_code from sim.supply s
             join item i on i.business_id = sim.business() and i.name = s.item
            where s.supplier = p_supplier loop
    select -coalesce(sum(m.base_quantity_signed), 0) / 14 into v_use
      from inventory_movement m
     where m.item_id = r.id and m.location_id = sim.main()
       and m.type in ('sale_consumption', 'production_consumption')
       and m.occurred_at >= now() - interval '14 days';
    if (select count(*) from sales_order where placed_at >= now() - interval '14 days') < 500 then
      v_use := greatest(v_use, r.daily);
    end if;
    v_have := coalesce((select qty from stock_balance where item_id = r.id and location_id = sim.main()), 0);
    v_qty := ceil(v_use * v_cover - v_have);
    if v_qty > 0 then
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'item_id', r.id, 'qty', v_qty, 'unit_code', r.base_unit_code, 'unit_price', sim.price(r.item, v_day)));
    end if;
  end loop;
  if jsonb_array_length(v_lines) = 0 then return null; end if;
  v_res := receive_goods(v_sup, v_lines, p_location => sim.main(), p_confirm => true);
  return (record_bill(v_sup, 'SIM-' || (v_res ->> 'receipt_no'), v_day, (v_res ->> 'value')::numeric, 30,
                      (v_res ->> 'receipt_id')::uuid, null) ->> 'bill_id')::uuid;
end $$;
grant execute on function sim.deliver(text) to authenticated;

-- The bills due by today (some paid late: p_late_days), paid from the bank.
create or replace function sim.pay_due(p_late_days int default 0) returns int
language plpgsql security definer set search_path = public, sim as $$
declare r record; n int := 0;
begin
  for r in select id, amount_total - paid_amount as owed from purchase_invoice
            where business_id = sim.business() and not is_paid and cancelled_at is null
              and due_date + p_late_days <= business_local_date(sim.business(), now())
              and amount_total - paid_amount > 0 loop
    perform pay_bill(r.id, r.owed, 'bank');
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function sim.pay_due(int) to authenticated;

-- The kitchen's batches, by whoever is acting (the barista): each of the
-- gelato and the croissants made up to p_share of a day's sales (gelato in
-- 5 kg pans, croissants in batches of 40): in the morning for the day, in the
-- afternoon a top-up for the evening.
create or replace function sim.make(p_share numeric default 1.15, p_first_guess numeric default 0.9)
returns int
language plpgsql security definer set search_path = public, sim as $$
declare r record; v_sold numeric; v_have numeric; v_batches numeric; n int := 0;
begin
  for r in select rc.id as recipe, rc.output_item_id as item, rc.batch_yield_base as yield
             from recipe rc where rc.business_id = sim.business() and rc.output_item_id is not null
              and rc.is_active and rc.name not like 'Golden%' loop
    -- A day's sales over the last three days (or the days there are), with
    -- a first guess of a pan or a batch a day before there is history.
    select -coalesce(sum(m.base_quantity_signed), 0)
           / greatest(1, least(3, extract(day from now() - min(m.occurred_at)) + 1)) into v_sold
      from inventory_movement m where m.item_id = r.item and m.location_id = sim.main()
       and m.type = 'sale_consumption' and m.occurred_at >= now() - interval '3 days';
    v_sold := greatest(coalesce(v_sold, 0), r.yield * p_first_guess);
    v_have := coalesce((select qty from stock_balance where item_id = r.item and location_id = sim.main()), 0);
    v_batches := ceil((v_sold * p_share - v_have) / r.yield);
    if v_batches > 0 then
      perform record_production(r.recipe, v_batches, p_location => sim.main(), p_stock_approval => null);
      n := n + v_batches::int;
    end if;
  end loop;
  return n;
end $$;
grant execute on function sim.make(numeric, numeric) to authenticated;

-- At closing, the croissants left are thrown away; gelato keeps.
create or replace function sim.throw_leftovers() returns numeric
language plpgsql security definer set search_path = public, sim as $$
declare v_item uuid := (select id from item where business_id = sim.business() and name = 'Croissant');
        v_left numeric;
begin
  v_left := floor(coalesce((select qty from stock_balance where item_id = v_item and location_id = sim.main()), 0));
  if v_left > 0 then
    perform record_waste(v_item, v_left, 'each', 'expired', 'Left at closing', sim.main(), null, false);
  end if;
  return v_left;
end $$;
grant execute on function sim.throw_leftovers() to authenticated;

-- The drawer open at the branch closed by the acting cashier: counted as the
-- books expect (what was there at opening and what moved since) less p_short
-- (a planted shortage, or a small honest difference); 50,000 left for the
-- next shift, the rest to the safe. A cashier is not shown what is expected
-- (a blind count): the helper works it out as the café's books do.
create or replace function sim.close_drawer(p_short numeric default 0) returns numeric
language plpgsql security definer set search_path = public, sim as $$
declare s work_shift; v_expected numeric; v_counted numeric;
begin
  select * into s from work_shift where location_id = sim.main() and kind = 'session' and closed_at is null
   order by opened_at desc limit 1;
  if not found then return null; end if;
  v_expected := coalesce(s.opening_counted, 0) + (session_figures(s.id)).moved;
  v_counted := greatest(v_expected - p_short, 0);
  perform close_cash_session(v_counted, null, least(50000, v_counted), 'safe');
  return v_counted - v_expected;
end $$;
grant execute on function sim.close_drawer(numeric) to authenticated;

-- What the safe holds, banked (by a manager or the owner).
create or replace function sim.bank_the_safe() returns numeric
language plpgsql security definer set search_path = public, sim as $$
declare v_held numeric;
begin
  select coalesce(sum(l.debit - l.credit), 0) into v_held
    from journal_line l join journal_entry e on e.id = l.journal_entry_id
    join gl_account a on a.id = l.account_id
   where e.business_id = sim.business() and a.code = '1005';
  v_held := floor(v_held / 1000) * 1000;
  if v_held > 0 then perform move_cash('safe', 'bank', v_held, 'Banked'); end if;
  return v_held;
end $$;
grant execute on function sim.bank_the_safe() to authenticated;

-- The card machine's money for the days up to yesterday, paid into the bank
-- less the bank's 1.5% (by the owner, twice a week).
create or replace function sim.settle_cards() returns numeric
language plpgsql security definer set search_path = public, sim as $$
declare v_day date := business_local_date(sim.business(), now()) - 1;
        v jsonb := card_takings(); v_total numeric;
begin
  select coalesce(sum((d ->> 'amount')::numeric), 0) into v_total
    from jsonb_array_elements(v -> 'days') d where (d ->> 'day')::date <= v_day;
  if v_total <= 0 then return 0; end if;
  perform record_card_settlement(v_day, v_total, round(v_total * 0.985 / 250) * 250,
                                 v_day + 1, null, null, gen_random_uuid());
  return v_total;
end $$;
grant execute on function sim.settle_cards() to authenticated;

-- The menu by short names, so the year's script reads plainly.
create table if not exists sim.menu (key text primary key, product text not null, variant text not null);
insert into sim.menu values
  ('espresso', 'Espresso', 'Single'), ('americano', 'Americano', 'Regular'),
  ('latte', 'Latte', 'Regular'), ('vanilla_latte', 'Vanilla Latte', 'Regular'),
  ('iced_latte', 'Iced Latte', 'Medium'), ('slushy', 'Strawberry Slushy', 'Regular'),
  ('cone_pistachio', 'Gelato Cone', 'Single / Pistachio'),
  ('cup_chocolate', 'Gelato Cup', 'Single / Chocolate'), ('cup_vanilla', 'Gelato Cup', 'Single / Vanilla'),
  ('cup_pistachio', 'Gelato Cup', 'Single / Pistachio'),
  ('croissant', 'Croissant', 'Plain'), ('water', 'Bottled Water', '500 ml')
on conflict (key) do nothing;

-- A sale the café's own rules refused (most often: something ran out), kept
-- so the buying backtest can count the sales lost to a shortage.
create table if not exists sim.refused (
  at timestamptz not null default now(), cashier text, items text, reason text not null
);
grant insert on sim.refused to authenticated;

-- A sale as the acting cashier: p_items 'latte*2,croissant*1'. Returns the
-- sale, or null when the café's own rules refuse it (kept in sim.refused).
create or replace function sim.sale(p_channel sales_channel, p_tender tender_type, p_items text,
                                    p_discount numeric default null, p_order_no text default null)
returns uuid language plpgsql security definer set search_path = public, sim as $$
declare v_lines jsonb := '[]'; x text; v jsonb;
begin
  foreach x in array string_to_array(p_items, ',') loop
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', (select pv.id from sim.menu m join product p on p.business_id = sim.business() and p.name = m.product
                       join product_variant pv on pv.product_id = p.id and pv.name = m.variant
                      where m.key = split_part(x, '*', 1)),
      'qty', split_part(x, '*', 2)::int));
  end loop;
  v := record_sale(gen_random_uuid(), p_channel, p_tender, v_lines, sim.main(),
                   p_discount_percent => p_discount,
                   p_discount_reason => case when p_discount is not null then 'regular' end,
                   p_platform_order_no => p_order_no);
  return (v ->> 'order_id')::uuid;
exception when others then
  insert into sim.refused (cashier, items, reason) values ((current_member()).full_name, p_items, sqlerrm);
  return null;
end $$;
grant execute on function sim.sale(sales_channel, tender_type, text, numeric, text) to authenticated;

-- The acting manager voids the last completed sale a cashier took in cash
-- (a planted void, or an honest mistake put right).
create or replace function sim.void_last(p_cashier text, p_code text) returns uuid
language plpgsql security definer set search_path = public, sim as $$
declare v_order uuid;
begin
  select o.id into v_order from sales_order o join app_user u on u.id = o.cashier_id
   where u.full_name = p_cashier and o.status = 'completed'
     and exists (select 1 from sales_tender t where t.sales_order_id = o.id and t.tender_type = 'cash')
   order by o.placed_at desc limit 1;
  if v_order is null then return null; end if;
  perform void_sale(v_order, case p_code when 'customer_left' then 'The customer left without paying'
                                         when 'rang_twice' then 'Rang it up twice'
                                         else 'Rang the wrong item' end, p_code);
  return v_order;
exception when others then
  raise warning 'void refused: %', sqlerrm;
  return null;
end $$;
grant execute on function sim.void_last(text, text) to authenticated;
