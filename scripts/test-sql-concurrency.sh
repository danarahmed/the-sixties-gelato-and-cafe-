#!/usr/bin/env bash
# =============================================================================
# Concurrency: the races the audit found (H-01, H-11) only happen with truly
# parallel sessions, so this starts real ones and releases them at the same
# instant.
#
# The gate: one session holds an exclusive advisory lock; every worker first
# waits for a SHARED hold on the same lock. When the gate session ends, all
# workers are released together and race into the function under test.
#
# Run by scripts/test-sql.sh after the template is built (it needs sixties_tpl).
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}"
PSQL=(psql -X -q -At -v ON_ERROR_STOP=1 --no-psqlrc)
DB=sixties_concurrency
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"; "${PSQL[@]}" -d postgres -c "drop database if exists $DB with (force)" >/dev/null 2>&1 || true' EXIT

"${PSQL[@]}" -d postgres -c "drop database if exists $DB with (force)" >/dev/null 2>&1
"${PSQL[@]}" -d postgres -c "create database $DB template sixties_tpl" >/dev/null
sql() { "${PSQL[@]}" -d "$DB" -c "$1"; }

# race N AS SQL — run SQL as person AS in N sessions released together; each
# worker's output (or error) lands in $WORK/<i>.
race() {
  local n=$1 who=$2 stmt=$3 i
  rm -f "$WORK"/*.out
  "${PSQL[@]}" -d "$DB" -c "select pg_advisory_lock(424242), pg_sleep(1.5)" >/dev/null &
  local gate=$!
  sleep 0.4
  for i in $(seq 1 "$n"); do
    ( "${PSQL[@]}" -d "$DB" \
        -c "select test.act_as('$who')" \
        -c "select pg_advisory_lock_shared(424242)" \
        -c "$stmt" >"$WORK/$i.out" 2>&1 || true ) &
  done
  wait
}
ok() { if [ "$1" = "$2" ]; then echo "  ✓ $3"; else echo "  ✗ $3 (got $1, want $2)"; FAILED=1; fi; }
FAILED=0

sql "select test.golden_catalogue()" >/dev/null

echo "▸ concurrency"

# H-01 — ten tills submit the same sale at once: one order, nine replays.
race 10 cashier@example.com "select record_sale('77777777-0000-0000-0000-000000000001','dine_in','cash','[{\"variant_id\":\"d1000000-0000-0000-0000-000000000001\",\"qty\":1}]')"
ok "$(sql "select count(*) from sales_order where idempotency_key = '77777777-0000-0000-0000-000000000001'")" "1" \
   "10 simultaneous submissions of one sale record exactly one order"
ok "$(grep -l '"replayed": true' "$WORK"/*.out | wc -l | tr -d ' ')" "9" "and the other nine are told it was already recorded"
ok "$(sql "select count(*) from journal_entry where reference_id = (select id from sales_order where idempotency_key = '77777777-0000-0000-0000-000000000001')")" "1" \
   "with exactly one journal"

# H-11 — ten people pay the same 20,000 bill in full at once: one payment.
sql "select test.act_as('manager@example.com');
     select receive_goods((select id from supplier limit 1), '[{\"item_id\":\"c0000000-0000-0000-0000-000000000002\",\"qty\":10,\"goods_value\":20000}]',
                          p_confirm => true);
     select record_bill((select id from supplier limit 1), 'RACE-1', test.today(), 20000, 0,
                        (select id from goods_receipt order by receipt_no desc limit 1));" >/dev/null
BILL=$(sql "select id from purchase_invoice where invoice_no = 'RACE-1'")
race 10 owner@example.com "select pay_bill('$BILL', 20000, 'bank')"
ok "$(sql "select count(*) from supplier_payment where purchase_invoice_id = '$BILL'")" "1" \
   "10 simultaneous full payments of one bill: exactly one goes through"
ok "$(sql "select paid_amount from purchase_invoice where id = '$BILL'")" "20000" "the bill is paid once, never overpaid"

# 0035 — ten sessions send the same delivery, the same expense and the same
# close of the drawer with one key at the same instant: each is recorded once,
# and the other nine are told it already was.
RECEIPTS=$(sql "select count(*) from goods_receipt")
race 10 manager@example.com "select receive_goods((select id from supplier order by name limit 1),
  '[{\"item_id\":\"c0000000-0000-0000-0000-000000000002\",\"qty\":4,\"goods_value\":8000}]',
  p_confirm => true, p_idempotency_key => '88888888-0000-0000-0000-000000000001')"
ok "$(( $(sql "select count(*) from goods_receipt") - RECEIPTS ))" "1" \
   "10 simultaneous sends of one delivery with one key receive it once"
ok "$(grep -l '"replayed": true' "$WORK"/*.out | wc -l | tr -d ' ')" "9" "and the other nine are told it was already received"
race 10 manager@example.com "select record_expense('Race ice', 1000, '6900', 'owner', null, '88888888-0000-0000-0000-000000000002')"
ok "$(sql "select count(*) from expense where description = 'Race ice'")" "1" "10 simultaneous sends of one expense record it once"
sql "select test.act_as('cashier@example.com');
     select record_sale(gen_random_uuid(),'dine_in','cash','[{\"variant_id\":\"d1000000-0000-0000-0000-000000000001\",\"qty\":3}]');" >/dev/null
race 10 manager@example.com "select close_cash_session(5000, null, 0, 'safe', p_idempotency_key => '88888888-0000-0000-0000-000000000003')"
ok "$(sql "select count(*) from work_shift where kind = 'session' and closed_at is not null")" "1" \
   "10 simultaneous sends of one close of the drawer close it once"
ok "$(sql "select count(*) from cash_transfer")" "1" "and move the takings to the safe once"

# 0036 — ten people open the one drawer at the same moment: one session opens,
# and the other nine are told it is open already.
race 10 cashier@example.com "select open_cash_session(0)"
ok "$(sql "select count(*) from work_shift where kind = 'session' and closed_at is null")" "1" \
   "10 people opening the drawer at once open one session"
ok "$(grep -l 'The drawer is already open' "$WORK"/*.out | wc -l | tr -d ' ')" "9" "and the other nine are told it is open"

# 0037 — ten managers each refund one espresso of a sale of three, at once:
# three go through, and never more is given back than was sold.
REFUND_SALE=$(sql "select test.act_as('cashier@example.com');
  select record_sale(gen_random_uuid(),'dine_in','cash','[{\"variant_id\":\"d1000000-0000-0000-0000-000000000001\",\"qty\":3}]') ->> 'order_id';" | tail -n 1)
REFUND_LINE=$(sql "select id from sales_order_line where sales_order_id = '$REFUND_SALE'")
race 10 manager@example.com "select refund_sale_lines('$REFUND_SALE', '[{\"line_id\":\"$REFUND_LINE\",\"qty\":1}]', 'changed_mind')"
ok "$(grep -l '"refund_no"' "$WORK"/*.out | wc -l | tr -d ' ')" "3" \
   "ten refunds of one espresso each, from a sale of three: three go through"
ok "$(sql "select trim_scale(sum(qty)) || ' ' || trim_scale(sum(amount)) from sale_refund_line
            where sales_order_line_id = '$REFUND_LINE'")" "3 7500" \
   "and never more is given back than was sold: three, 7,500"
ok "$(sql "select status from sales_order where id = '$REFUND_SALE'")" "refunded" "the sale is refunded in full, once"

# 0038 — ten managers correct the same delivery at once, 10 sleeves of cups to 8:
# one correction is made; the other nine find nothing left to change.
CORR_RECEIPT=$(sql "select test.act_as('manager@example.com');
  select receive_goods((select id from supplier order by name limit 1),
    '[{\"item_id\":\"c0000000-0000-0000-0000-000000000002\",\"qty\":10,\"unit_code\":\"sleeve_50\",\"unit_price\":2500}]',
    p_confirm => true) ->> 'receipt_id';" | tail -n 1)
CORR_LINE=$(sql "select id from goods_receipt_line where goods_receipt_id = '$CORR_RECEIPT'")
race 10 manager@example.com "select correct_receipt('$CORR_RECEIPT',
  '[{\"line_id\":\"$CORR_LINE\",\"item_id\":\"c0000000-0000-0000-0000-000000000002\",\"qty\":8,\"unit_code\":\"sleeve_50\",\"unit_price\":2500}]',
  null, null, 'Only 8 came')"
ok "$(grep -l '"correction_no"' "$WORK"/*.out | wc -l | tr -d ' ')" "1" \
   "ten corrections of one delivery at once: one is made"
ok "$(grep -l 'Nothing was changed' "$WORK"/*.out | wc -l | tr -d ' ')" "9" "and the other nine find nothing left to change"
ok "$(sql "select count(*) || ' ' || trim_scale(sum(base_quantity_signed)) from inventory_movement
            where reference_type = 'receipt_correction'
              and reference_id in (select id from receipt_correction where goods_receipt_id = '$CORR_RECEIPT')")" "1 -100" \
   "two sleeves, 100 cups, out of stock once"

# H-10 — five bottles, prevention on, ten simultaneous sales of one each.
# Through record_waste, which journals it: a raw ledger insert here would be
# exactly the unjournaled movement the reconciliation below exists to catch.
sql "update business set prevent_negative_stock = true where id = '00000000-0000-0000-0000-0000000000b1';
     select test.act_as('manager@example.com');
     select record_waste('c0000000-0000-0000-0000-000000000003', 19, null, 'damaged', 'leave five on the shelf');" >/dev/null
race 10 cashier@example.com "select record_sale(gen_random_uuid(),'dine_in','cash','[{\"variant_id\":\"d1000000-0000-0000-0000-000000000002\",\"qty\":1}]')"
ok "$(grep -l '"order_id"' "$WORK"/*.out | wc -l | tr -d ' ')" "5" "ten tills racing for five bottles sell exactly five"
ok "$(sql "select (item_position('00000000-0000-0000-0000-0000000000b1','c0000000-0000-0000-0000-000000000003',
                                  default_location('00000000-0000-0000-0000-0000000000b1'))).qty")" "0" \
   "and stock ends at zero, never below"

# H-02 — twenty journals published at once: twenty consecutive numbers.
BEFORE=$(sql "select count(*) from journal_entry where journal_no is not null")
race 20 owner@example.com "select save_journal(test.today(), 'race', '[{\"code\":\"6200\",\"debit\":1},{\"code\":\"1020\",\"credit\":1}]', true)"
ok "$(sql "select count(*) - $BEFORE from journal_entry where journal_no is not null")" "20" "20 simultaneous journals all publish"
ok "$(sql "select (max(journal_no) - min(journal_no) + 1) = count(*) from journal_entry where journal_no is not null")" "t" \
   "numbered consecutively, with no gaps and no collisions"

# A table's bill: ten tills press Pay at the same moment, each with its own
# payment key. One sale; the other nine are handed that sale.
TAB=$(sql "select test.act_as('cashier@example.com');
           select open_tab('dine_in', null, 'Race table') ->> 'tab_id'" | tail -1)
sql "select test.act_as('cashier@example.com');
     select save_tab('$TAB', 1, '[{\"variant_id\":\"d1000000-0000-0000-0000-000000000001\",\"qty\":2}]')" >/dev/null
race 10 cashier@example.com "select settle_tab('$TAB', 2, gen_random_uuid(), 'cash')"
ok "$(sql "select count(*) from sales_order o join pos_tab t on t.sales_order_id = o.id where t.id = '$TAB'")" "1" \
   "10 tills paying one bill at once record exactly one sale"
ok "$(sql "select count(*) from sales_order where created_at > now() - interval '1 minute' and net_amount = 5000")" "1" \
   "and no stray second sale"
ok "$(grep -l '"replayed": true' "$WORK"/*.out | wc -l | tr -d ' ')" "9" "the other nine are handed the sale already recorded"

# Ten tills save changes to one bill from the same version: one wins, nine are told to reopen it.
TAB=$(sql "select test.act_as('cashier@example.com');
           select open_tab('dine_in', null, 'Busy table') ->> 'tab_id'" | tail -1)
race 10 cashier@example.com "select save_tab('$TAB', 1, '[{\"variant_id\":\"d1000000-0000-0000-0000-000000000001\",\"qty\":1}]')"
ok "$(grep -l 'changed on another till' "$WORK"/*.out | wc -l | tr -d ' ')" "9" \
   "10 tills saving one bill at once: one change wins, nine are refused"
ok "$(sql "select version from pos_tab where id = '$TAB'")" "2" "and the bill moved on by exactly one version"

# 0036 — ten cash sales racing the close of the drawer's session: each goes
# into the session before the close counts it, or is refused once it has
# closed; none falls outside a session, and nothing deadlocks.
sql "select test.act_as('manager@example.com'); select cancel_tab('$TAB', 2, 'Party left')" >/dev/null
SOLD=$(sql "select count(*) from sales_order where status = 'completed'")
SESSION=$(sql "select id from work_shift where kind = 'session' and closed_at is null")
rm -f "$WORK"/*.out
"${PSQL[@]}" -d "$DB" -c "select pg_advisory_lock(424242), pg_sleep(1.5)" >/dev/null &
sleep 0.4
for i in $(seq 1 10); do
  ( "${PSQL[@]}" -d "$DB" -c "select test.act_as('cashier@example.com')" -c "select pg_advisory_lock_shared(424242)" \
      -c "select record_sale(gen_random_uuid(),'dine_in','cash','[{\"variant_id\":\"d1000000-0000-0000-0000-000000000001\",\"qty\":1}]')" \
      >"$WORK/$i.out" 2>&1 || true ) &
done
( "${PSQL[@]}" -d "$DB" -c "select test.act_as('manager@example.com')" -c "select pg_advisory_lock_shared(424242)" \
    -c "select close_cash_session(0) ->> 'session_id'" >"$WORK/count.out" 2>&1 || true ) &
wait
RECORDED=$(sql "select count(*) - $SOLD from sales_order where status = 'completed'")
ok "$(( RECORDED + $(grep -l 'Open the drawer first' "$WORK"/[0-9]*.out | wc -l | tr -d ' ') ))" "10" \
   "ten cash sales race the close of the drawer: each is recorded, or refused once it has closed"
ok "$(grep -c 'ERROR' "$WORK/count.out" || true)" "0" "the close goes through beside them"
ok "$(sql "select expected_cash = opening_counted + (select coalesce(sum(amount), 0) from cash_event where work_shift_id = w.id)
             from work_shift w where id = '$SESSION'")" "t" \
   "the session closed on exactly the cash that came in before it"
ok "$(sql "select count(*) from cash_event where work_shift_id is null")" "0" "no sale's cash falls outside a session"
ok "$(sql "select (select sum(amount) from cash_event where kind = 'sale')
               = (select sum(t.amount) from sales_tender t where t.tender_type = 'cash')")" "t" \
   "exactly once: the cash in the sessions equals the cash taken"

# 0034 — through every race above, each order took a turn number of its own:
# none shared, and none skipped, though sales were refused and payments replayed.
ok "$(sql "select count(*) = count(distinct turn_no) and count(*) = count(turn_no) from sales_order")" "t" \
   "each sale has its own turn number, however many tills raced"
ok "$(sql "select max(n) = count(distinct n) from (select turn_no n from sales_order
                                                  union all select turn_no from pos_tab) x")" "t" \
   "and none was skipped, though sales were refused and payments replayed"

# 0029 — ten dashboards opened at once: each brings the alerts up to date, one
# at a time, and none is refused; every condition keeps one open alert.
race 10 owner@example.com "select count(*) from current_alerts()"
ok "$(cat "$WORK"/*.out | grep -c 'ERROR' || true)" "0" "ten dashboards opened at once all load their alerts"
ok "$(sql "select count(*) from (select rule, subject from alert where resolved_at is null group by 1, 2 having count(*) > 1) x")" "0" \
   "and each condition has one open alert, not ten"
ok "$(sql "select count(*) from alert where resolved_at is null")" \
   "$(sql "select count(*) from alert_conditions('00000000-0000-0000-0000-0000000000b1', now())")" \
   "one for every condition the rules find"

# The books still tie after all of it.
ok "$(sql "select string_agg(difference::text, ',') from (select test.act_as('owner@example.com')) a, report_reconciliation(test.today())")" \
   "0,0,0,0,0,0,0,0,0" "every subledger still reconciles to its control account"

[ "$FAILED" -eq 0 ]
