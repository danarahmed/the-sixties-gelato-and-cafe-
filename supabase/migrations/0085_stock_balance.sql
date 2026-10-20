-- =============================================================================
-- 0085 — Stock on hand kept as it moves (G2: speed under a rush)
-- =============================================================================
-- What a place holds of an item was added up from every movement it ever had
-- (item_position, current_stock), on every sale, twice for each item its
-- recipe uses. A café that has sold for a year has a hundred thousand
-- movements of its coffee: each sale grew slower, the dashboard and the stock
-- screens too. Measured on a copy: a sale took twice as long at 14,000
-- movements of an item as at 4,000.
--
--  * stock_balance: each item's quantity and value at each place, kept by the
--    movements themselves (a trigger, whatever records them): what the
--    movements add up to, read in one row.
--  * item_position and current_stock read it. Nothing else changes: the
--    movements stay the record, and the database's test checks the two agree.
--  * Stock written at a place is written one transaction after another (a
--    lock for the place, held until the sale is saved: milliseconds), so two
--    tills selling the same things in a different order never wait on each
--    other for ever.
--  * The last price an item was bought at, read when none is in stock, and
--    an account's balance (the stock's value, the safe, the statements), are
--    found from an index instead of a scan of everything.
--
-- Nothing recorded changes.
-- =============================================================================

create table if not exists stock_balance (
  business_id uuid not null references business (id) on delete cascade,
  item_id     uuid not null,
  location_id uuid not null,
  qty         numeric not null default 0,
  value       numeric not null default 0,
  primary key (business_id, item_id, location_id)
);

-- Read as the movements are: by those who see costs.
alter table stock_balance enable row level security;
alter table stock_balance force row level security;
drop policy if exists cost_read on stock_balance;
create policy cost_read on stock_balance for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('cost.view')));
revoke all on stock_balance from public, anon, authenticated;
grant select on stock_balance to authenticated;

-- -----------------------------------------------------------------------------
-- 1. Kept by the movements
-- -----------------------------------------------------------------------------
create or replace function trg_inventory_movement_balance() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform pg_advisory_xact_lock(hashtextextended('stock:' || old.location_id::text, 0));
    update stock_balance
       set qty = qty - old.base_quantity_signed,
           value = value - coalesce(old.value, 0) * sign(old.base_quantity_signed)
     where business_id = old.business_id and item_id = old.item_id and location_id = old.location_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform pg_advisory_xact_lock(hashtextextended('stock:' || new.location_id::text, 0));
    insert into stock_balance as b (business_id, item_id, location_id, qty, value)
    values (new.business_id, new.item_id, new.location_id, new.base_quantity_signed,
            coalesce(new.value, 0) * sign(new.base_quantity_signed))
    on conflict (business_id, item_id, location_id) do update
      set qty = b.qty + excluded.qty, value = b.value + excluded.value;
  end if;
  return null;
end $$;

create or replace function trg_inventory_movement_truncate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  truncate stock_balance;
  return null;
end $$;

drop trigger if exists inventory_movement_balance on inventory_movement;
create trigger inventory_movement_balance after insert or update or delete on inventory_movement
  for each row execute function trg_inventory_movement_balance();
drop trigger if exists inventory_movement_truncate on inventory_movement;
create trigger inventory_movement_truncate after truncate on inventory_movement
  for each statement execute function trg_inventory_movement_truncate();

-- What the movements add up to now, no movement written meanwhile.
do $$
begin
  lock table inventory_movement in share row exclusive mode;
  insert into stock_balance as b (business_id, item_id, location_id, qty, value)
  select business_id, item_id, location_id, sum(base_quantity_signed),
         sum(coalesce(value, 0) * sign(base_quantity_signed))
    from inventory_movement
   group by business_id, item_id, location_id
  on conflict (business_id, item_id, location_id) do update set qty = excluded.qty, value = excluded.value;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Read in one row
-- -----------------------------------------------------------------------------
-- 0015's, from the balance.
create or replace function item_position(p_business uuid, p_item uuid, p_location uuid,
                                         out qty numeric, out value numeric)
language sql stable security definer set search_path = public as $$
  select coalesce(b.qty, 0), coalesce(b.value, 0)
    from (select 1) one
    left join stock_balance b on b.business_id = p_business and b.item_id = p_item and b.location_id = p_location
$$;
revoke execute on function item_position(uuid, uuid, uuid) from public, anon, authenticated;

-- 0003's, from the balance: the same columns, read by those who see costs.
create or replace view current_stock with (security_invoker = on) as
select business_id, item_id, location_id, qty as quantity_base, value as value_signed
  from stock_balance;

-- The last price an item was bought at (item_issue_cost), from an index.
create index if not exists inventory_movement_last_cost
  on inventory_movement (business_id, item_id, occurred_at desc, created_at desc)
  where base_quantity_signed > 0 and unit_cost > 0;

-- An account's balance (gl_balance_at: the stock's value on the dashboard, the
-- safe, the statements) read from that account's lines, not every line.
create index if not exists journal_line_account
  on journal_line (account_id) include (journal_entry_id, debit, credit);

revoke execute on function trg_inventory_movement_balance(), trg_inventory_movement_truncate()
  from public, anon, authenticated;
