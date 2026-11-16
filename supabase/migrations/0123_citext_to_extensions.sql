-- =============================================================================
-- 0123 — citext moves out of the public schema (OPEN_PLANS plan 7, item 11)
-- =============================================================================
-- citext is the add-on behind one column, a member's email (app_user.email).
-- On the live database it was installed in the public schema, the one the app
-- reads through, so Supabase's security advisor warns ("Extension in Public"):
-- its 47 small functions (citext_eq, regexp_replace, …) showed up as if
-- they were the system's own, callable by anyone, signed in or not.
--
-- It moves to the extensions schema, where Supabase keeps add-ons and where
-- the test database has always had it. This was the one known difference
-- between the live database and the rehearsals (docs/guides/deployment.md,
-- "identical, but for the schema citext lives in"); after this there is none.
--
-- Nothing recorded changes and emails match as before:
--   * the column keeps its type; only the type's address changes;
--   * the three functions that read an email (invite_member, list_members,
--     link_confirmed_login) compare lower(email::text), which needs nothing
--     from citext;
--   * no index, view, policy, constraint or trigger names it, and the app
--     never filters people by email.
-- Rehearsed with tests/sql/search_path.test.sql, and by moving citext to
-- public in a copy and back with this file.
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
              where e.extname = 'citext' and n.nspname = 'public') then
    alter extension citext set schema extensions;
  end if;
end $$;
