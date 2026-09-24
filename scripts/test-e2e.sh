#!/usr/bin/env bash
# =============================================================================
# End-to-end checks: the real app, through a real PostgREST, against a scratch
# database built from the migrations, driven by a browser as each role.
#
#   PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres scripts/test-e2e.sh
#   scripts/test-e2e.sh flows          # one suite
#   E2E_KEEP=1 scripts/test-e2e.sh ... # leave the servers up to investigate
#
# Needs: a PostgreSQL 15+ server you may create databases on (the same one
# scripts/test-sql.sh uses), Node 20+, and Playwright with Chromium (set
# PLAYWRIGHT_MJS to its index.mjs if it is not resolvable from here).
# PostgREST is downloaded once into ~/.cache/sixties-e2e.
#
# Auth is a local stand-in (tests/e2e/gateway.mjs) that issues real JWTs for the
# fixture people, so sessions, row-level security and every database function
# are exercised exactly as in production. It never touches a hosted project.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}"
export E2E_DB=sixties_e2e E2E_BASE=http://127.0.0.1:3100 NEXT_TELEMETRY_DISABLED=1
export JWT_SECRET="local-e2e-only-$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/sixties-e2e"
LOGS="$(mktemp -d)"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 --no-psqlrc)
PIDS=()

cleanup() {
  if [ -n "${E2E_KEEP:-}" ]; then echo "(E2E_KEEP: servers left running; logs in $LOGS)"; return; fi
  for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done
  "${PSQL[@]}" -d postgres -c "drop database if exists $E2E_DB with (force)" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if [ -z "${PLAYWRIGHT_MJS:-}" ] && ! node -e "require.resolve('playwright')" 2>/dev/null; then
  export PLAYWRIGHT_MJS="$(npm root -g)/playwright/index.mjs"
fi

# PostgREST, once.
POSTGREST="$CACHE/postgrest"
if [ ! -x "$POSTGREST" ]; then
  mkdir -p "$CACHE"
  curl -sSL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz \
    | tar -xJ -C "$CACHE"
fi

echo "▸ database"
scripts/test-sql.sh tests/sql/smoke.test.sql >/dev/null   # (re)builds the sixties_tpl template
"${PSQL[@]}" -d postgres -c "drop database if exists $E2E_DB with (force)" >/dev/null 2>&1
"${PSQL[@]}" -d postgres -c "create database $E2E_DB template sixties_tpl" >/dev/null
"${PSQL[@]}" -d "$E2E_DB" >/dev/null 2>&1 <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;
end $$;
grant anon, authenticated, service_role to authenticator;
select test.golden_catalogue();
SQL
echo "  built from the migrations, with the fixture people and a small catalogue"

echo "▸ PostgREST and the auth stand-in"
cat > "$LOGS/postgrest.conf" <<EOF
db-uri = "postgres://authenticator@$PGHOST:$PGPORT/$E2E_DB"
db-schemas = "public"
db-anon-role = "anon"
db-extra-search-path = "public, extensions"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = 54330
log-level = "warn"
EOF
"$POSTGREST" "$LOGS/postgrest.conf" >"$LOGS/postgrest.log" 2>&1 & PIDS+=($!)
node tests/e2e/gateway.mjs >"$LOGS/gateway.log" 2>&1 & PIDS+=($!)
for _ in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:54330/ && break; sleep 0.25; done

echo "▸ app"
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY="$(node tests/e2e/anon-key.mjs)"
export NEXT_PUBLIC_SUPABASE_ANON_KEY
node_modules/.bin/next build >"$LOGS/build.log" 2>&1 || { tail -30 "$LOGS/build.log"; exit 1; }
# Started directly (not through npx) so the PID recorded is the server's own.
node_modules/.bin/next start -p 3100 >"$LOGS/next.log" 2>&1 & PIDS+=($!)
for _ in $(seq 1 60); do curl -s -o /dev/null "$E2E_BASE/login" && break; sleep 0.5; done

fail=0
suites=("$@")
[ ${#suites[@]} -eq 0 ] && suites=(pages flows retry offline bills)
for t in "${suites[@]}"; do
  node "tests/e2e/$t.e2e.mjs" || fail=1
done
[ "$fail" -eq 0 ] && echo "E2E: all passed" || { echo "E2E: failures (logs in $LOGS)"; exit 1; }
