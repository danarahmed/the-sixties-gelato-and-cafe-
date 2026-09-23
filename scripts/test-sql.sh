#!/usr/bin/env bash
# =============================================================================
# SQL test runner — exercises the real migrations against real PostgreSQL.
#
# Two phases:
#
#   1. Upgrade check. Applies migrations 0001..$PRODUCTION_HEAD (what the live
#      database already has), loads production-shaped history written the way
#      the old application wrote it, then applies every later migration on top
#      and runs tests/sql/upgrade/*.check.sql. This is the rehearsal for
#      applying the migrations to production: it fails if they would not apply
#      cleanly, or if they would alter or lose any existing record.
#
#   2. Tests. Builds a clean template once (all migrations + master/recipe seed
#      + fixtures) and runs each tests/sql/*.test.sql in its own fresh copy, so
#      no test can leak state into another.
#
# Needs a PostgreSQL 15+ server you may create databases on. It is NEVER
# pointed at the production Supabase project — it creates and drops its own.
#
#   PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres scripts/test-sql.sh
#   scripts/test-sql.sh tests/sql/controls.test.sql     # tests phase, one file
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}"
PRODUCTION_HEAD="${PRODUCTION_HEAD:-0013}"   # last migration applied to the live database
PSQL=(psql -X -q -v ON_ERROR_STOP=1 --no-psqlrc)

run() { "${PSQL[@]}" -d "$1" -f "$2" 2>&1; }
# Migrations run as ONE transaction per file, exactly as the Supabase CLI
# applies them. Running them statement-by-statement would hide failures that
# only happen inside a transaction (e.g. ALTER TABLE with pending trigger events).
#
# Migrations also run as sb_admin, a role shaped like Supabase's `postgres`:
# not a superuser, but able to bypass row-level security. Seed and test data
# are loaded by the superuser; the code under test is owned by sb_admin.
run_migration() { PGOPTIONS="-c search_path=public,extensions" \
  "${PSQL[@]}" --single-transaction -U sb_admin -d "$1" -f "$2" 2>&1; }
fresh_db() {
  "${PSQL[@]}" -d postgres -c "drop database if exists $1 with (force)" >/dev/null 2>&1
  "${PSQL[@]}" -d postgres -c "create database $1 ${2:+template $2}" >/dev/null
}
drop_db() { "${PSQL[@]}" -d postgres -c "drop database if exists $1 with (force)" >/dev/null 2>&1; }

# apply_migrations DB FROM TO — every migration whose number is in [FROM, TO].
apply_migrations() {
  local db=$1 from=$2 to=$3 m n
  for m in supabase/migrations/*.sql; do
    n=$(basename "$m" | cut -c1-4)
    if [[ "$n" > "$to" || "$n" < "$from" ]]; then continue; fi
    if ! out=$(run_migration "$db" "$m"); then
      echo "✗ migration failed: $m"; echo "$out" | grep -v NOTICE | head -20; return 1
    fi
  done
}

base_setup() {
  run "$1" tests/sql/harness/supabase_shim.sql >/dev/null
  run "$1" tests/sql/harness/assert.sql >/dev/null
}

pass=0; fail=0

# --------------------------------------------------------------- 1. upgrade
if [ $# -eq 0 ] && ls tests/sql/upgrade/*.check.sql >/dev/null 2>&1; then
  echo "▸ upgrade rehearsal: 0001..$PRODUCTION_HEAD, production-shaped history, then the rest"
  fresh_db sixties_upgrade
  base_setup sixties_upgrade
  apply_migrations sixties_upgrade 0000 "$PRODUCTION_HEAD"
  run sixties_upgrade supabase/seed/01_master.sql >/dev/null
  run sixties_upgrade supabase/seed/02_recipes.sql >/dev/null
  run sixties_upgrade tests/sql/harness/fixtures.sql >/dev/null
  if ! out=$(run sixties_upgrade tests/sql/harness/legacy_data.sql); then
    echo "✗ legacy data failed to load"; echo "$out" | head -10; exit 1
  fi
  next=$(printf '%04d' $((10#$PRODUCTION_HEAD + 1)))
  if apply_migrations sixties_upgrade "$next" 9999; then
    echo "  migrations $next+ applied cleanly on top of existing history"
    for f in tests/sql/upgrade/*.check.sql; do
      if out=$(run sixties_upgrade "$f"); then
        pass=$((pass + 1)); echo "  ✓ $(basename "$f")"
      else
        fail=$((fail + 1)); echo "  ✗ $(basename "$f")"
        echo "$out" | grep -E "ASSERTION FAILED|ERROR" | head -5 | sed 's/^/      /'
      fi
    done
  else
    fail=$((fail + 1))
  fi
  drop_db sixties_upgrade
fi

# ----------------------------------------------------------------- 2. tests
echo "▸ building clean template"
fresh_db sixties_tpl
base_setup sixties_tpl
apply_migrations sixties_tpl 0000 9999 || exit 1
run sixties_tpl supabase/seed/01_master.sql >/dev/null
run sixties_tpl supabase/seed/02_recipes.sql >/dev/null
run sixties_tpl tests/sql/harness/fixtures.sql >/dev/null
echo "  $(ls supabase/migrations/*.sql | wc -l) migrations applied"

files=("$@")
[ ${#files[@]} -eq 0 ] && files=(tests/sql/*.test.sql)

for f in "${files[@]}"; do
  db="sixties_t_$(basename "$f" .test.sql | tr -c 'a-z0-9\n' '_')"
  fresh_db "$db" sixties_tpl
  if out=$(run "$db" "$f"); then
    pass=$((pass + 1)); echo "  ✓ $(basename "$f")"
  else
    fail=$((fail + 1)); echo "  ✗ $(basename "$f")"
    echo "$out" | grep -E "ASSERTION FAILED|ERROR" | head -5 | sed 's/^/      /'
  fi
  drop_db "$db"
done

# ----------------------------------------------------------- 3. concurrency
if [ $# -eq 0 ]; then
  if scripts/test-sql-concurrency.sh; then pass=$((pass + 1)); else fail=$((fail + 1)); fi
fi

echo
echo "SQL tests: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
