-- =============================================================================
-- Minimal assertion helpers for the SQL test suite (no pgTAP dependency).
--
-- Every helper raises on failure, so a test file stops at its first broken
-- expectation and the runner reports which one. test.throws() runs the
-- statement in a subtransaction and forces deferred constraints to check
-- immediately, so COMMIT-time rules (the journal balance trigger) are caught
-- inside the test rather than surfacing later as an unrelated failure.
-- =============================================================================

create schema if not exists test;
grant usage on schema test to public;

create or replace function test.ok(cond boolean, msg text) returns void
language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'ASSERTION FAILED: %', msg;
  end if;
end $$;

create or replace function test.eq(got anyelement, want anyelement, msg text) returns void
language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'ASSERTION FAILED: % (got %, want %)', msg, got, want;
  end if;
end $$;

-- Expect `stmt` to raise an error whose message matches `pattern` (ILIKE).
create or replace function test.throws(stmt text, pattern text, msg text) returns void
language plpgsql as $$
declare
  err text;
begin
  begin
    set constraints all immediate;
    execute stmt;
    set constraints all immediate;
  exception when others then
    err := sqlerrm;
  end;
  if err is null then
    raise exception 'ASSERTION FAILED: % (statement succeeded, expected an error matching "%")', msg, pattern;
  end if;
  if err not ilike pattern then
    raise exception 'ASSERTION FAILED: % (error was "%", expected match for "%")', msg, err, pattern;
  end if;
end $$;

-- Expect `stmt` to succeed, deferred constraints included.
create or replace function test.succeeds(stmt text, msg text) returns void
language plpgsql as $$
begin
  begin
    set constraints all immediate;
    execute stmt;
    set constraints all immediate;
  exception when others then
    raise exception 'ASSERTION FAILED: % (unexpected error: %)', msg, sqlerrm;
  end;
end $$;

-- Rows affected by a statement, for asserting that RLS silently filtered a write.
create or replace function test.rowcount(stmt text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on all functions in schema test to public;
