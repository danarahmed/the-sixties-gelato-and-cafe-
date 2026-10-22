-- =============================================================================
-- The simulated café on the eve of its year (22 October 2025, evening): its
-- people, what its suppliers charge, its opening money, and the answer key.
-- Run after setup.sql, with the clock set to that evening.
-- =============================================================================
\set ON_ERROR_STOP on

-- ---------------------------------------------------------------- the people
-- Six who work the till and the kitchen, besides the demo manager and owner.
-- Lana is hired on 1 August 2026: a new cashier who makes a beginner's
-- mistakes for her first weeks (not a problem; a good watch list waits).
create table if not exists sim.people (email text primary key, name text, role app_role, title text, pay numeric, hired date);
grant select on sim.people to authenticated;
insert into sim.people values
  ('avin@sim.example',   'Avin',   'cashier', 'Cashier', 650000, '2024-03-01'),
  ('dara@sim.example',   'Dara',   'cashier', 'Cashier', 650000, '2024-06-15'),
  ('karwan@sim.example', 'Karwan', 'cashier', 'Cashier', 650000, '2023-11-01'),
  ('bana@sim.example',   'Bana',   'cashier', 'Cashier', 650000, '2024-09-01'),
  ('shno@sim.example',   'Shno',   'barista', 'Barista', 750000, '2023-05-10'),
  ('lana@sim.example',   'Lana',   'cashier', 'Cashier', 600000, '2026-08-01')
on conflict do nothing;

insert into auth.users (id, email)
select gen_random_uuid(), email from sim.people on conflict do nothing;
insert into app_user (business_id, full_name, email, auth_user_id)
select sim.business(), p.name, p.email, u.id from sim.people p join auth.users u on u.email = p.email
on conflict do nothing;
insert into user_role (app_user_id, role)
select a.id, p.role from sim.people p join app_user a on a.email = p.email
on conflict do nothing;

-- Read as the administrator: a login cannot read the people of the café.
create table if not exists sim.hire as
select p.name, p.title, p.hired, a.id as app_user from sim.people p join app_user a on a.email = p.email
union all
select 'Demo Manager', 'Branch manager', date '2023-01-01', id from app_user where email = 'manager@example.com';
grant select on sim.hire to authenticated;
create temp table sim_main as select sim.main() as id;
grant select on sim_main to authenticated;

select test.act_as('owner@example.com');
select save_employee(null, h.name, null, h.title, (select id from sim_main), h.hired, h.app_user, gen_random_uuid())
  from sim.hire h;
select test.as_admin();
create table if not exists sim.pay as
select e.id, coalesce(p.pay, 1200000) as pay from employee e left join sim.people p on p.name = e.full_name
 where e.business_id = sim.business() and (p.name is not null or e.full_name = 'Demo Manager');
grant select on sim.pay to authenticated;
select test.act_as('owner@example.com');
select set_employee_pay(id, 'monthly', pay, 8, null, 'Agreed when hired', gen_random_uuid()) from sim.pay;

-- ---------------------------------------------------------------- the suppliers
select test.as_admin();
insert into sim.supplier_plan values
  ('Sulaymaniyah Dairy Co.', 2, 4),          -- milk, cream, butter, ice: every other day
  ('Kurdistan Coffee Imports', 7, 11),      -- beans, dry goods, syrups, water: weekly
  ('City Packaging Supplies', 14, 19)       -- cups, lids and the rest: every fortnight
on conflict (supplier) do update set every_days = excluded.every_days, cover_days = excluded.cover_days;
update supplier set lead_time_days = case name when 'Sulaymaniyah Dairy Co.' then 1
                                                when 'Kurdistan Coffee Imports' then 3 else 2 end
 where business_id = sim.business();
-- How often each delivers (once 0092 is applied: What to buy's drafts read it).
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'supplier' and column_name = 'delivers_every_days') then
    execute $q$update supplier set delivers_every_days = case name when 'Sulaymaniyah Dairy Co.' then 2
                                                              when 'Kurdistan Coffee Imports' then 7 else 14 end
                where business_id = sim.business()$q$;
  end if;
end $$;

-- Prices per gram, millilitre or piece, in IQD, as an Erbil café pays in 2025.
insert into sim.supply (item, supplier, price, daily) values
  ('Milk',                          'Sulaymaniyah Dairy Co.',   1.30,  9000),
  ('Cream',                         'Sulaymaniyah Dairy Co.',   6.50,  1500),
  ('Butter',                        'Sulaymaniyah Dairy Co.',  13.00,   500),
  ('Ice',                           'Sulaymaniyah Dairy Co.',   0.15,  6000),
  ('Coffee beans',                  'Kurdistan Coffee Imports', 32.00, 2500),
  ('Sugar',                         'Kurdistan Coffee Imports',  1.60, 1500),
  ('Flour',                         'Kurdistan Coffee Imports',  1.20, 1000),
  ('Pistachio paste',               'Kurdistan Coffee Imports', 45.00,  150),
  ('Vanilla syrup',                 'Kurdistan Coffee Imports', 16.00,  800),
  ('Strawberry slushy concentrate', 'Kurdistan Coffee Imports', 11.00,  900),
  ('Bottled water',                 'Kurdistan Coffee Imports', 250,     25),
  ('Takeaway cup',                  'City Packaging Supplies',  120,    120),
  ('Cup lid',                       'City Packaging Supplies',   50,    140),
  ('Gelato cup',                    'City Packaging Supplies',   90,     60),
  ('Cone',                          'City Packaging Supplies',  150,     30),
  ('Cone sleeve',                   'City Packaging Supplies',   20,     30),
  ('Gelato spoon',                  'City Packaging Supplies',   25,     90),
  ('Napkin',                        'City Packaging Supplies',   10,    250),
  ('Delivery bag',                  'City Packaging Supplies',  100,     50),
  ('Drink carrier',                 'City Packaging Supplies',  150,     15),
  ('Slushy cup',                    'City Packaging Supplies',  130,     15),
  ('Bakery box',                    'City Packaging Supplies',  250,     10),
  ('Straw',                         'City Packaging Supplies',   15,     40),
  ('Sticker',                       'City Packaging Supplies',   15,     30),
  ('Tamper seal',                   'City Packaging Supplies',   20,     30)
on conflict (item) do nothing;

-- Prices that rise through the year (as the owner's plan asks for).
insert into sim.price_rise values
  ('Coffee beans',  '2026-01-15', 1.12),   -- the importer's new year price
  ('Milk',          '2026-04-01', 1.08),
  ('Cream',         '2026-04-01', 1.08),
  ('Pistachio paste','2026-06-01', 1.15),  -- a poor harvest
  ('Takeaway cup',  '2026-07-01', 1.10),
  ('Gelato cup',    '2026-07-01', 1.10),
  ('Coffee beans',  '2026-09-01', 1.05)
on conflict do nothing;

-- Each item's usual supplier, at the starting price.
create table if not exists sim.supply_ids as
select i.id as item, s.id as supplier, i.base_unit_code as unit, x.price
  from sim.supply x join item i on i.business_id = sim.business() and i.name = x.item
  join supplier s on s.business_id = sim.business() and s.name = x.supplier;
grant select on sim.supply_ids to authenticated;
select test.act_as('owner@example.com');
select set_item_supplier(item, supplier, unit, price, true, gen_random_uuid()) from sim.supply_ids;

-- ---------------------------------------------------------------- opening money
-- The owner puts 6,000,000 IQD in the bank to start the year (a journal by
-- hand, as the owner would enter it on Journals): little, as a café runs, so
-- the quarter's rent, the owner's drawings and the new machine bite.
select test.act_as('owner@example.com');
select save_journal(current_date, 'Opening capital (simulated year)',
  jsonb_build_array(jsonb_build_object('code', '1020', 'debit', 6000000),
                    jsonb_build_object('code', '3000', 'credit', 6000000)),
  true, null, null, gen_random_uuid());
select test.as_admin();

-- ---------------------------------------------------------------- the answer key
insert into sim.planted (kind, who, starts, ends, problem, note) values
  ('discounts',    'Dara',   '2025-12-20', '2026-10-21', true,
   'Gives a 9% discount (just under the 10% a cashier may give alone) on about one sale in fourteen, from 20 December; before, like everyone else. Not to be confused with the students'' 8% (a promotion everyone gives in the afternoons from February)'),
  ('voids',        'Karwan', '2026-03-15', '2026-10-21', true,
   'About one in thirty of his cash sales voided a few minutes later, from 15 March. The evening has more honest voids for everyone on it (customers gone before the coffee came)'),
  ('drawer_short', 'Bana',   '2026-05-07', '2026-10-21', true,
   'Her Thursday evening drawer is 6,000–14,000 IQD short, from 7 May'),
  ('new_staff',    'Lana',   '2026-08-01', '2026-08-21', false,
   'New: voids about one sale in fifty, and half her drawers 2,000–9,000 short, in her first three weeks while she learns; then like everyone else. Not a problem: a good watch list gives new staff time');

insert into sim.config values ('start', '2025-10-23'), ('end', '2026-10-21')
on conflict (key) do update set value = excluded.value;
