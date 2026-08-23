-- =============================================================================
-- 0011_period_admin.sql — let the demo AI Accountant create + lock accounting
-- periods and act on insights. Scoped to the demo business (same pattern as
-- 0010). Locking a period is the human-approved "finalize" step; the existing
-- forbid_locked_period trigger then blocks any further posting into it.
--
-- ⚠️ Replace with per-user JWT (tenant_isolation) + a server-side service role
-- for the AI actor before serving real multi-tenant data.
-- =============================================================================

-- accounting_period: allow the demo to create the current period and lock it.
drop policy if exists demo_rw_ins on accounting_period;
create policy demo_rw_ins on accounting_period
  for insert with check (business_id = '00000000-0000-0000-0000-0000000000b1');
drop policy if exists demo_rw_upd on accounting_period;
create policy demo_rw_upd on accounting_period
  for update using (business_id = '00000000-0000-0000-0000-0000000000b1')
  with check (business_id = '00000000-0000-0000-0000-0000000000b1');
grant insert, update on accounting_period to anon, authenticated;

-- ai_insight: allow status transitions (acknowledge / approve / dismiss).
drop policy if exists demo_rw_upd on ai_insight;
create policy demo_rw_upd on ai_insight
  for update using (business_id = '00000000-0000-0000-0000-0000000000b1')
  with check (business_id = '00000000-0000-0000-0000-0000000000b1');
grant update on ai_insight to anon, authenticated;

-- ai_interaction_log: the audit trail of every AI call (mock or real).
-- SELECT for display + INSERT to append. It is immutable (no update/delete).
drop policy if exists demo_rw_sel on ai_interaction_log;
create policy demo_rw_sel on ai_interaction_log
  for select using (business_id = '00000000-0000-0000-0000-0000000000b1');
drop policy if exists demo_rw_ins on ai_interaction_log;
create policy demo_rw_ins on ai_interaction_log
  for insert with check (business_id = '00000000-0000-0000-0000-0000000000b1');
grant select, insert on ai_interaction_log to anon, authenticated;
