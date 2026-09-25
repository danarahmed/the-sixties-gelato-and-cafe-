-- =============================================================================
-- Shared fixtures: link the four seeded people to fixed auth identities, and
-- give tests a one-line way to act as any of them (or as the anonymous public).
--
-- Switching identity works from any current role because SET ROLE is checked
-- against the SESSION user (the superuser running the tests), not the role a
-- test has already assumed.
-- =============================================================================

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner@example.com'),
  ('a0000000-0000-0000-0000-00000000000b', 'manager@example.com'),
  ('a0000000-0000-0000-0000-00000000000c', 'cashier@example.com'),
  ('a0000000-0000-0000-0000-00000000000d', 'counter@example.com')
on conflict do nothing;

update app_user set auth_user_id = 'a0000000-0000-0000-0000-00000000000a' where email = 'owner@example.com';
update app_user set auth_user_id = 'a0000000-0000-0000-0000-00000000000b' where email = 'manager@example.com';
update app_user set auth_user_id = 'a0000000-0000-0000-0000-00000000000c' where email = 'cashier@example.com';
update app_user set auth_user_id = 'a0000000-0000-0000-0000-00000000000d' where email = 'counter@example.com';

-- A second business, so tenant isolation can be tested for real.
insert into business (id, name) values ('00000000-0000-0000-0000-0000000000b2', 'Other Café')
on conflict do nothing;

-- Act as a named person: authenticated role + their JWT subject.
create or replace function test.act_as(p_email text) returns void
language plpgsql as $$
declare uid uuid;
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
  select id into uid from auth.users where email = p_email;
  if uid is null then raise exception 'test.act_as: no auth user %', p_email; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;

-- Act as the anonymous public: what anyone holding the published anon key gets.
create or replace function test.act_as_anon() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, false);
  execute 'set role anon';
end $$;

-- Back to the test superuser, for setup and for inspecting true state.
create or replace function test.as_admin() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
end $$;

grant execute on all functions in schema test to public;

-- A journal, as one readable line: "1000 Dr 5000 | 4000 Cr 5000", accounts in
-- code order. Golden tests compare against this, so an expected entry reads
-- exactly as an accountant would write it.
-- Inspection helpers read ground truth whoever the test is acting as, so they
-- run as their (superuser) owner. That cashiers cannot read the ledger is
-- asserted separately, in controls.test.sql.
create or replace function test.lines_of(p_ref uuid) returns text
language sql security definer as $$
  select string_agg(a.code || case when l.debit > 0 then ' Dr ' || l.debit::text
                                   else ' Cr ' || l.credit::text end,
                    ' | ' order by a.code, l.debit desc, l.credit desc)
    from journal_entry e
    join journal_line l on l.journal_entry_id = e.id
    join gl_account a on a.id = l.account_id
   where e.reference_id = p_ref and e.reverses_entry is null
$$;

-- What a sale cost, as recorded on the order.
create or replace function test.cogs_of(p_order uuid) returns numeric
language sql security definer as $$
  select cogs_amount from sales_order where id = p_order
$$;

-- The balance of an account for the demo business (debit-positive).
create or replace function test.balance(p_code text) returns numeric
language sql security definer as $$
  select coalesce(sum(l.debit - l.credit), 0)
    from journal_line l join gl_account a on a.id = l.account_id
    join journal_entry e on e.id = l.journal_entry_id
   where a.code = p_code and a.business_id = '00000000-0000-0000-0000-0000000000b1'
     and e.status = 'published'
$$;

-- The demo business's trading day, in its own time zone. Tests date things
-- with this, never with current_date: from 21:00 to midnight UTC, Baghdad is
-- already on the next day, and a test dated by the server's clock would
-- disagree with the business it is testing.
-- (plpgsql, so it can be defined before the migration that adds the function.)
create or replace function test.today() returns date
language plpgsql stable security definer as $$
begin
  return business_local_date('00000000-0000-0000-0000-0000000000b1', now());
end $$;

-- A small, fully known catalogue for golden tests: coffee at 10 IQD/g, an
-- espresso that uses 20 g, priced 2,500 dine-in and 3,000 on Talabat, plus a
-- takeaway cup that only the takeaway channel consumes.
create or replace function test.golden_catalogue() returns void
language plpgsql as $$
declare
  b uuid := '00000000-0000-0000-0000-0000000000b1';
  loc uuid; m record;
begin
  perform test.as_admin();
  select id into loc from location where business_id = b and kind = 'branch' limit 1;
  insert into item (id, business_id, sku, name, item_type, base_unit_code, dimension, returnable_to_stock)
  values ('c0000000-0000-0000-0000-000000000001', b, 'G-BEANS', 'Golden beans', 'ingredient', 'g', 'mass', false),
         ('c0000000-0000-0000-0000-000000000002', b, 'G-CUP',   'Golden cup',   'packaging',  'each', 'count', false),
         ('c0000000-0000-0000-0000-000000000003', b, 'G-WATER', 'Golden water', 'resale',     'each', 'count', true);
  insert into item_unit (item_id, code, label, dimension, factor_to_base)
  values ('c0000000-0000-0000-0000-000000000001', 'kg', 'Kilogram', 'mass', 1000),
         ('c0000000-0000-0000-0000-000000000002', 'sleeve_50', 'Sleeve of 50', 'count', 50);
  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value, reason, occurred_at)
  values (b, 'c0000000-0000-0000-0000-000000000001', loc, 'opening_balance', 1000, 10, 10000, 'fixture', now() - interval '1 minute'),
         (b, 'c0000000-0000-0000-0000-000000000002', loc, 'opening_balance', 100, 50, 5000, 'fixture', now() - interval '1 minute'),
         (b, 'c0000000-0000-0000-0000-000000000003', loc, 'opening_balance', 24, 250, 6000, 'fixture', now() - interval '1 minute');

  insert into product (id, business_id, name) values ('d0000000-0000-0000-0000-000000000001', b, 'Golden espresso'),
                                                     ('d0000000-0000-0000-0000-000000000002', b, 'Golden water');
  insert into product_variant (id, product_id, name) values ('d1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Single'),
                                                            ('d1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'Bottle');
  update product_variant set resale_item_id = 'c0000000-0000-0000-0000-000000000003' where id = 'd1000000-0000-0000-0000-000000000002';
  insert into recipe (id, business_id, name) values ('d2000000-0000-0000-0000-000000000001', b, 'Golden espresso');
  insert into recipe_version (id, recipe_id, version_no, effective_from)
  values ('d3000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 1, '2020-01-01');
  insert into recipe_line (recipe_version_id, component_type, item_id, quantity, unit_code, applies_to_channels)
  values ('d3000000-0000-0000-0000-000000000001', 'item', 'c0000000-0000-0000-0000-000000000001', 20, 'g', null),
         ('d3000000-0000-0000-0000-000000000001', 'item', 'c0000000-0000-0000-0000-000000000002', 1, 'each', '{takeaway,talabat}');
  insert into variant_recipe (product_variant_id, recipe_id) values ('d1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001');
  insert into channel_price (business_id, product_variant_id, channel, price, effective_from) values
    (b, 'd1000000-0000-0000-0000-000000000001', 'dine_in', 2500, '2020-01-01'),
    (b, 'd1000000-0000-0000-0000-000000000001', 'takeaway', 2500, '2020-01-01'),
    (b, 'd1000000-0000-0000-0000-000000000001', 'talabat', 3000, '2020-01-01'),
    (b, 'd1000000-0000-0000-0000-000000000002', 'dine_in', 1000, '2020-01-01');
  -- The opening stock is in the books too, journaled the way the app journals
  -- it — one entry per movement — so subledger and GL start equal and nothing
  -- is mistaken for stock the old app never journaled.
  for m in select id, value from inventory_movement
            where business_id = b and type = 'opening_balance' and reason = 'fixture' loop
    perform post_journal(b, now() - interval '1 minute', 'Opening stock (fixture)', 'inventory_movement', m.id,
      jsonb_build_array(jsonb_build_object('code', '1200', 'debit', m.value),
                        jsonb_build_object('code', '3000', 'credit', m.value)));
  end loop;
end $$;

grant execute on all functions in schema test to public;
