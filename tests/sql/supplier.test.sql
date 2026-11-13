-- =============================================================================
-- The supplier parts (0111): water sold by the carton of 24 takes 24 bottles
-- from stock; a hotel on account has its own price for the carton; a quote at
-- that price is sent, accepted and invoiced at it even after the price
-- changes; a delivery note goes out and is signed for; a credit note takes
-- what was given back off what the hotel owes.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p text) returns jsonb language sql as $$ select v from res where k = p $$;
create function pg_temp.hotel() returns uuid language sql security definer as $$
  select id from customer where full_name = 'Hotel Ankawa' $$;
create function pg_temp.carton() returns uuid language sql security definer as $$
  select v.id from product_variant v join product p on p.id = v.product_id where p.name = 'Water carton' $$;
create function pg_temp.water_left() returns numeric language sql security definer as $$
  select sum(base_quantity_signed) from inventory_movement where item_id = 'c0000000-0000-0000-0000-000000000003' $$;
grant execute on function pg_temp.r(text), pg_temp.hotel(), pg_temp.carton(), pg_temp.water_left() to public;

select test.act_as('owner@example.com');
select set_business_part('price_lists', true, 'We sell to hotels');
select set_business_part('quotes', true, 'Hotels ask for quotes');

-- ------------------------------------------------------------ by the carton
select test.throws($$select make_item_sellable('c0000000-0000-0000-0000-000000000003', 'Too many', '{"takeaway": 1}', 5000)$$,
  'A pack is from 1 to 1000 of the item', 'a sensible pack');
select make_item_sellable('c0000000-0000-0000-0000-000000000003', 'Water carton', '{"takeaway": 6000, "dine_in": 6000}', 24);
create temp table w0 as select pg_temp.water_left() as n;
grant select on w0 to public;
select test.act_as('cashier@example.com');
select record_sale(gen_random_uuid(), 'takeaway', 'cash', jsonb_build_array(jsonb_build_object('variant_id', pg_temp.carton(), 'qty', 1)));
select test.eq((select n from w0) - pg_temp.water_left(), 24::numeric, 'a carton sold takes 24 bottles');

-- ------------------------------------------------------------ a customer's own price
select test.act_as('owner@example.com');
select save_customer(null, 'Hotel Ankawa', '0750 111 2233');
select set_customer_account(pg_temp.hotel(), true, 100000, 30, 10);
select test.throws(format('select set_customer_price(%L, %L, -1)', pg_temp.hotel(), pg_temp.carton()),
  'A price is 0 or more', 'a price is 0 or more');
select set_customer_price(pg_temp.hotel(), pg_temp.carton(), 5000);
select test.eq(jsonb_array_length(customer_prices(pg_temp.hotel())), 1, 'the hotel has its price');

-- ------------------------------------------------------------ a quote, invoiced at its price
insert into res select 'q', save_quote(null, pg_temp.hotel(),
  jsonb_build_array(jsonb_build_object('variant_id', pg_temp.carton(), 'qty', 4)), test.today() + 7, 'For the weekend');
select test.eq((pg_temp.r('q') ->> 'total')::numeric, 20000::numeric, 'four cartons at the hotel''s 5,000');
select set_quote_status((pg_temp.r('q') ->> 'id')::uuid, 'sent');
select set_quote_status((pg_temp.r('q') ->> 'id')::uuid, 'accepted');
-- The hotel's price rises after the quote: the quote keeps its own.
select set_customer_price(pg_temp.hotel(), pg_temp.carton(), 5500);
insert into res select 'inv', quote_to_invoice((pg_temp.r('q') ->> 'id')::uuid, gen_random_uuid());
select test.eq((pg_temp.r('inv') ->> 'status'), 'invoiced', 'invoiced');
select test.as_admin();
select test.eq((select amount::int from customer_invoice where id = (pg_temp.r('inv') ->> 'invoice_id')::uuid), 20000,
  'at the quote''s prices');
select test.act_as('owner@example.com');
select test.throws(format('select set_quote_status(%L, %L)', pg_temp.r('q') ->> 'id', 'cancelled'),
  'That quote is closed', 'an invoiced quote is closed');
select test.eq(jsonb_array_length(quotes(true)), 0, 'no quote open now');

-- ------------------------------------------------------------ delivered
insert into res select 'dn', make_delivery_note((pg_temp.r('inv') ->> 'invoice_id')::uuid, 'Hama', 'Ankawa road');
select test.throws(format('select make_delivery_note(%L, %L)', pg_temp.r('inv') ->> 'invoice_id', 'Hama'),
  'That invoice has a delivery note on its way already', 'one at a time');
select set_delivery_status((pg_temp.r('dn') -> 0 ->> 'id')::uuid, 'out');
select test.throws(format('select set_delivery_status(%L, %L)', pg_temp.r('dn') -> 0 ->> 'id', 'delivered'),
  'Say who signed for it', 'signed for');
select set_delivery_status((pg_temp.r('dn') -> 0 ->> 'id')::uuid, 'delivered', 'Reception, Dara');
select test.eq(delivery_notes(true) -> 0 ->> 'status', 'delivered', 'delivered and signed for');

-- ------------------------------------------------------------ a credit note
select test.throws(format('select credit_customer(%L, 30000, %L)', pg_temp.hotel(), 'Two cartons back'),
  'Hotel Ankawa owes 20000: a credit note is at most that', 'no more than they owe');
select credit_customer(pg_temp.hotel(), 10000, 'Two cartons came back broken');
select test.as_admin();
select test.eq(customer_balance(pg_temp.hotel())::int, 10000, 'they owe 10,000 now');
select test.eq((select sum(l.debit - l.credit)::int from journal_line l join gl_account g on g.id = l.account_id
                 join journal_entry e on e.id = l.journal_entry_id
                where g.code = '4200' and e.reference_type = 'customer_payment'), 10000, 'to returns, 4200');

-- Off for a café.
select test.act_as('owner@example.com');
select set_business_part('quotes', false, 'Not needed any more');
select test.throws($$select quotes(true)$$, 'That part is off for this business: Quotes, sales orders and delivery notes',
  'a part off refuses its work');
