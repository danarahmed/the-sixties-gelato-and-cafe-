-- =============================================================================
-- 0122 — A fixed search_path for the last helpers (OPEN_PLANS plan 7, item 11)
-- =============================================================================
-- Supabase's security advisor warns of every function with no fixed
-- search_path ("Function Search Path Mutable"). 0099 fixed the rarely called
-- ones and left 24 that are called for each line of a sale or a report, in
-- case a fixed one slowed them.
--
-- Measured (200,000 calls each, before and after): a fixed search_path costs
-- between 1 and 4 millionths of a second a call. A sale of ten lines is
-- slower by well under a thousandth of a second; a report over 100,000 lines
-- by about a third of a second at the most. No index, view, policy or
-- constraint uses any of them. So each is given one now, and the warning ends.
--
-- What it guards against: a function with no fixed search_path looks for the
-- tables and functions it names wherever its caller says to look first. None
-- of these runs with raised rights and nobody but the owner may make a table
-- or a function here, so it could not be used today; with a fixed one it
-- cannot be, whatever changes later.
--
-- Nothing recorded changes and nothing works differently: each looks in
-- public, then extensions, as it did when the app called it. Rehearsed with
-- tests/sql/search_path.test.sql.
-- =============================================================================

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind in ('f', 'p')
       -- Not a function an extension brought with it.
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
     order by 1
  loop
    execute format('alter routine %s set search_path = public, extensions', f.sig);
  end loop;
end $$;
