#!/usr/bin/env bash
# =============================================================================
# The app for the guide's pictures: the real app, through a real PostgREST and
# the e2e auth stand-in, on a copy of the simulated year (docs/SIMULATION.md),
# so every screen shows a café with a year behind it. Never a hosted project.
#
#   scripts/sim/run.sh --buying drafts   # once: the year (SIM_DB=sixties_sim_drafts,
#                                        #   SIM_PORT=5434, SIM_DIR=/var/lib/postgresql/sim2)
#   scripts/guide/serve.sh               # copies it, starts the servers, leaves them up
#   node scripts/guide/shots.mjs         # the pictures, into docs/guide/shots
#   scripts/guide/serve.sh stop
#
# The year's server and the app both run on the year's clock (libfaketime): the
# evening of its last day (GUIDE_AT, Baghdad time), so "today" is a full day.
# The copy is sixties_guide on that server; the app is at http://127.0.0.1:3100
# and signs in the fixture people (owner@example.com…).
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGHOST=127.0.0.1 PGPORT="${SIM_PORT:-5434}" PGUSER="${PGUSER:-postgres}"
export E2E_DB=sixties_guide E2E_BASE=http://127.0.0.1:3100 NEXT_TELEMETRY_DISABLED=1
SIM_DIR="${SIM_DIR:-/var/lib/postgresql/sim2}" SIM_DB="${SIM_DB:-sixties_sim_drafts}"
FAKETIME_LIB=${FAKETIME_LIB:-/usr/lib/x86_64-linux-gnu/faketime/libfaketime.so.1}
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/sixties-e2e"
RUN="${GUIDE_RUN:-/tmp/sixties-guide}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 --no-psqlrc)
mkdir -p "$RUN"

stop() {
  for f in "$RUN"/*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null || true; rm -f "$f"; done
}
if [ "${1:-}" = "stop" ]; then stop; echo "stopped"; exit 0; fi
stop

echo "▸ the year's server, on the year's clock"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $SIM_DIR/data -m fast stop" >/dev/null 2>&1 || true
# The evening of the year's last day, as UTC for libfaketime.
AT_LOCAL="${GUIDE_AT:-}"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $SIM_DIR/data -o '-p $PGPORT -c listen_addresses=127.0.0.1' \
  -l $SIM_DIR/log start" >/dev/null
for _ in $(seq 1 40); do psql -Atc "select 1" postgres >/dev/null 2>&1 && break; sleep 0.25; done
if [ -z "$AT_LOCAL" ]; then
  AT_LOCAL=$(psql -Atc "select (max(day) || ' 23:58:00') from sim.day_log" "$SIM_DB")
fi
AT_UTC=$(psql -Atc "select to_char(('$AT_LOCAL'::timestamp at time zone 'Asia/Baghdad') at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')" postgres)
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $SIM_DIR/data -m fast stop" >/dev/null
echo "@$AT_UTC" > "$SIM_DIR/clock"; chown postgres "$SIM_DIR/clock"
su postgres -c "LD_PRELOAD=$FAKETIME_LIB FAKETIME_TIMESTAMP_FILE=$SIM_DIR/clock FAKETIME_NO_CACHE=1 \
  FAKETIME_DONT_FAKE_MONOTONIC=1 /usr/lib/postgresql/16/bin/pg_ctl -D $SIM_DIR/data \
  -o '-p $PGPORT -c listen_addresses=127.0.0.1 -c fsync=off -c jit=off' -l $SIM_DIR/log start" >/dev/null
for _ in $(seq 1 40); do psql -Atc "select 1" postgres >/dev/null 2>&1 && break; sleep 0.25; done
"${PSQL[@]}" -d postgres -c "drop database if exists $E2E_DB with (force)" \
  -c "create database $E2E_DB template $SIM_DB" >/dev/null
"${PSQL[@]}" -d "$E2E_DB" >/dev/null 2>&1 <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;
end $$;
grant anon, authenticated, service_role to authenticator;
analyze;
SQL
echo "  $(psql -Atc "select count(*) || ' sales to ' || max(placed_at at time zone 'Asia/Baghdad')::date || '; now ' || to_char(now() at time zone 'Asia/Baghdad', 'YYYY-MM-DD HH24:MI') from sales_order" "$E2E_DB")"

echo "▸ PostgREST and the auth stand-in"
JWT_SECRET="local-guide-only-$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
export JWT_SECRET
echo "$AT_UTC" > "$RUN/clock"
cat > "$RUN/postgrest.conf" <<EOF
db-uri = "postgres://authenticator@$PGHOST:$PGPORT/$E2E_DB"
db-schemas = "public"
db-anon-role = "anon"
db-extra-search-path = "public, extensions"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = 54330
log-level = "warn"
EOF
FAKE=(env LD_PRELOAD="$FAKETIME_LIB" FAKETIME="@$AT_UTC" FAKETIME_DONT_FAKE_MONOTONIC=1)
"$CACHE/postgrest" "$RUN/postgrest.conf" >"$RUN/postgrest.log" 2>&1 & echo $! > "$RUN/postgrest.pid"
# The sign-in stand-in keeps real time: PostgREST (a static binary) cannot be
# put on the year's clock, and would find tokens dated by it expired.
node tests/e2e/gateway.mjs >"$RUN/gateway.log" 2>&1 & echo $! > "$RUN/gateway.pid"
for _ in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:54330/ && break; sleep 0.25; done

echo "▸ app"
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY="$(node tests/e2e/anon-key.mjs)"
export NEXT_PUBLIC_SUPABASE_ANON_KEY
if [ -z "${GUIDE_NO_BUILD:-}" ]; then
  node_modules/.bin/next build >"$RUN/build.log" 2>&1 || { tail -30 "$RUN/build.log"; exit 1; }
fi
"${FAKE[@]}" node_modules/.bin/next start -p 3100 >"$RUN/next.log" 2>&1 & echo $! > "$RUN/next.pid"
for _ in $(seq 1 60); do curl -s -o /dev/null "$E2E_BASE/login" && break; sleep 0.5; done
echo "  $E2E_BASE on the clock of $AT_LOCAL, Baghdad (PGPORT=$PGPORT E2E_DB=$E2E_DB; logs in $RUN)"
