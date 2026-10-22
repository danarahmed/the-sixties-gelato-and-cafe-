#!/usr/bin/env bash
# The simulated year (SMART_PLAN step 7), on a copy — never the live database.
#
# A second PostgreSQL server (port 5433) runs under libfaketime, so its clock
# can be set to any moment: the year is lived day by day through the café's own
# functions, each sale at its own hour, and every report and the books agree
# as they would in a real café. Built from the test template (scripts/test-sql.sh
# builds it on the usual server), with the test catalogue, aged 400 days so the
# menu is in place a year ago, then the café of scripts/sim/cafe.sql, then the
# year of scripts/sim/year.py.
#
#   sudo apt-get install faketime            # once: libfaketime
#   scripts/test-sql.sh tests/sql/smoke.test.sql   # (re)builds the template
#   scripts/sim/run.sh                       # about 40 minutes
#   scripts/sim/run.sh --days 30             # a first month only, to try it
#   SIM_DB=sixties_sim_drafts scripts/sim/run.sh --buying drafts
#                                            # the same year, bought through
#                                            # What to buy's drafts (step 8)
#
# One year at a time: the server has one clock.
# Then: psql -h 127.0.0.1 -p 5433 -U postgres sixties_sim, and
# python3 scripts/sim/backtest.py for the backtests.
set -euo pipefail
cd "$(dirname "$0")/../.."

PGHOST=${PGHOST:-127.0.0.1}
PGUSER=${PGUSER:-postgres}
SRC_PORT=${PGPORT:-5432}
SIM_PORT=${SIM_PORT:-5433}
SIM_DIR=${SIM_DIR:-/var/lib/postgresql/sim}
SIM_DB=${SIM_DB:-sixties_sim}
FAKETIME_LIB=${FAKETIME_LIB:-/usr/lib/x86_64-linux-gnu/faketime/libfaketime.so.1}
WORK=$(mktemp -d)
PSQL=(psql -h "$PGHOST" -p "$SIM_PORT" -U "$PGUSER" -X -q -v ON_ERROR_STOP=1)

[ -f "$FAKETIME_LIB" ] || { echo "✗ libfaketime is needed: sudo apt-get install faketime"; exit 1; }

echo "▸ the clock-controlled server (port $SIM_PORT)"
mkdir -p "$SIM_DIR"
chown postgres:postgres "$SIM_DIR"
echo "@2025-10-22 17:00:00" > "$SIM_DIR/clock"
chown postgres "$SIM_DIR/clock"
if [ ! -f "$SIM_DIR/data/PG_VERSION" ]; then
  su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $SIM_DIR/data -A trust -U postgres" > /dev/null
fi
if ! "${PSQL[@]}" -d postgres -c "select 1" > /dev/null 2>&1; then
  su postgres -c "LD_PRELOAD=$FAKETIME_LIB FAKETIME_TIMESTAMP_FILE=$SIM_DIR/clock FAKETIME_NO_CACHE=1 \
    FAKETIME_DONT_FAKE_MONOTONIC=1 /usr/lib/postgresql/16/bin/pg_ctl -D $SIM_DIR/data \
    -o '-p $SIM_PORT -c listen_addresses=127.0.0.1 -c shared_buffers=512MB -c fsync=off \
        -c synchronous_commit=off -c full_page_writes=off -c jit=off' -l $SIM_DIR/log start" > /dev/null
  sleep 3
fi

echo "▸ the copy: the test template, its catalogue, aged a year"
pg_dumpall -h "$PGHOST" -p "$SRC_PORT" -U "$PGUSER" --roles-only 2>/dev/null \
  | grep -v '^CREATE ROLE postgres;' > "$WORK/roles.sql"
pg_dump -h "$PGHOST" -p "$SRC_PORT" -U "$PGUSER" -Fc sixties_tpl > "$WORK/tpl.dump"
psql -h "$PGHOST" -p "$SIM_PORT" -U "$PGUSER" -X -q -f "$WORK/roles.sql" > /dev/null 2>&1 || true
"${PSQL[@]}" -d postgres -c "drop database if exists $SIM_DB with (force)" -c "create database $SIM_DB"
pg_restore -h "$PGHOST" -p "$SIM_PORT" -U "$PGUSER" -d "$SIM_DB" --no-owner --role="$PGUSER" "$WORK/tpl.dump"
"${PSQL[@]}" -d "$SIM_DB" -c "select test.golden_catalogue()" > /dev/null
"${PSQL[@]}" -d "$SIM_DB" -f scripts/sim/age.sql > /dev/null

echo "▸ the café on the eve of its year"
"${PSQL[@]}" -d "$SIM_DB" -f scripts/sim/setup.sql > /dev/null
"${PSQL[@]}" -d "$SIM_DB" -c "insert into sim.config values ('clock_file', '$SIM_DIR/clock')
  on conflict (key) do update set value = excluded.value" > /dev/null
"${PSQL[@]}" -d "$SIM_DB" -f scripts/sim/cafe.sql > /dev/null

echo "▸ the year, day by day (log: $WORK/year.log)"
python3 scripts/sim/year.py "$@" \
  | psql -h "$PGHOST" -p "$SIM_PORT" -U "$PGUSER" -X -q -d "$SIM_DB" > "$WORK/year.out" 2> "$WORK/year.log" || true

echo "▸ done"
"${PSQL[@]}" -d "$SIM_DB" -At -F' | ' -c "
  select 'sales ' || count(*) || ', voided ' || count(*) filter (where status = 'voided')
         || ', from ' || min(placed_at)::date || ' to ' || max(placed_at)::date from sales_order"
echo "  refused by the café's own rules: $(grep -c '^ERROR' "$WORK/year.log" || true) (see $WORK/year.log)"
