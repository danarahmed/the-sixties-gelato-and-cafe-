-- Move every date and time of the starting café back by 400 days, so the
-- simulated year (from 23 October 2025) finds its menu, prices and recipes in
-- place. Run on the copy only (scripts/sim/run.sh).
set session_replication_role = replica;
do $$
declare r record; n int := 0;
begin
  for r in
    select c.table_schema, c.table_name, c.column_name, c.data_type
      from information_schema.columns c
      join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema in ('public', 'auth') and t.table_type = 'BASE TABLE'
       -- A period is a calendar month by its name: it is not moved, its
       -- entries are given their own month's below.
       and c.table_name <> 'accounting_period'
       and c.data_type in ('date', 'timestamp with time zone', 'timestamp without time zone')
       and not exists (select 1 from information_schema.columns g
                        where g.table_schema = c.table_schema and g.table_name = c.table_name
                          and g.column_name = c.column_name and g.is_generated = 'ALWAYS')
  loop
    execute format('update %I.%I set %I = %I - interval ''400 days'' where %I is not null',
                   r.table_schema, r.table_name, r.column_name, r.column_name, r.column_name);
    n := n + 1;
  end loop;
  raise notice 'aged % columns', n;
end $$;
-- Each moved journal entry in its own month's period (made as the café makes them).
update journal_entry set period_id = ensure_period(business_id, occurred_at::date)
 where period_id is distinct from ensure_period(business_id, occurred_at::date);
set session_replication_role = origin;
