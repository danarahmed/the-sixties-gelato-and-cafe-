-- =============================================================================
-- 0035 — Every write recorded once, whatever the connection does (release J)
--
-- Until now only a quick sale and a bill's payment were protected against a
-- lost answer: the till kept its key and a retry returned the sale already
-- recorded. Every other write — a delivery, a bill, a payment, an expense, a
-- loss, a batch, a count, a cash move, a journal, a bill at a table, a void, a
-- refund — made a new record on every call. A retry after a dropped answer
-- could record a delivery twice, move the takings to the safe twice, or open a
-- second bill (docs/COMPLETION_PLAN.md, D1).
--
-- Now each of those writes has a keyed version:
--   * The screen makes a key (a UUID) when the person submits, and sends it
--     with every retry of that submission.
--   * The first call does the work and stores its answer under the key, in the
--     same transaction: both are kept, or neither.
--   * A retry with the key gets that answer back, marked "replayed", and
--     records nothing. Two calls with one key at the same moment queue: the
--     second sees the first's answer.
--   * A key reused for another operation, other details, or by another person
--     is refused.
-- Each function keeps its name and parameters and gains a last one,
-- p_idempotency_key. The work itself is the original, unchanged, renamed
-- <name>__run and callable only from inside the database. The app sends a key
-- with every call (tests/rpc-contract.test.ts fails a call that does not); a
-- call with no key, from SQL or from an app not yet updated, runs as before.
--
-- Also here (docs/COMPLETION_PLAN.md, D13, D15, D16):
--   * Deliveries, supplier bills and payments, expenses, losses, batches,
--     journals, stock-count steps and tables are recorded on the audit trail.
--   * Only the owner may take away the access of an owner or a general manager.
--   * Wrong PINs no longer let one till user lock a manager out: the person
--     typing them is stopped after 3 in 15 minutes; a manager's approvals by PIN
--     pause after 20 wrong PINs in a day, until they set a new PIN.
--   * close_day, which only raises an error since 0024, is closed.
--   * A loss valued at nothing is recorded (with no journal) instead of failing.
--   * A batch whose output has already been used can no longer be cancelled.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The request log
-- ---------------------------------------------------------------------------
create table if not exists request_log (
  business_id  uuid not null references business(id) on delete cascade,
  key          uuid not null,
  operation    text not null,
  request_hash text not null,
  result       jsonb not null,
  app_user_id  uuid references app_user(id),
  created_at   timestamptz not null default now(),
  primary key (business_id, key)
);
alter table request_log enable row level security;
alter table request_log force row level security;
revoke all on request_log from public, anon, authenticated;

-- A key's first use proceeds (null); its retry gets the stored answer back.
create or replace function idem_begin(p_business uuid, p_key uuid, p_operation text, p_request jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r request_log;
begin
  if p_business is null then return null; end if;   -- not signed in: the operation itself refuses
  if p_key is null then return null; end if;          -- no key: done as before, unprotected
  -- One key at a time: a second call with it waits for the first to finish.
  perform pg_advisory_xact_lock(hashtextextended('request:' || p_business::text || ':' || p_key::text, 0));
  select * into r from request_log where business_id = p_business and key = p_key;
  if not found then return null; end if;
  if r.operation <> p_operation or r.request_hash <> md5(p_request::text) then
    raise exception 'This retry does not match what was first sent: reload the page and check before doing it again';
  end if;
  if r.app_user_id is distinct from current_app_user_id() then
    raise exception 'This was sent by someone else' using errcode = '42501';
  end if;
  return case when jsonb_typeof(r.result) = 'object'
              then r.result || jsonb_build_object('replayed', true)
              else r.result end;
end $$;

-- Store the answer with the work, in the same transaction.
create or replace function idem_finish(p_business uuid, p_key uuid, p_operation text,
                                       p_request jsonb, p_result jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_business is null or p_key is null then return; end if;
  insert into request_log (business_id, key, operation, request_hash, result, app_user_id)
  values (p_business, p_key, p_operation, md5(p_request::text), coalesce(p_result, 'null'::jsonb),
          current_app_user_id());
end $$;

revoke all on function idem_begin(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function idem_finish(uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Fixes to the originals (same signatures)
-- ---------------------------------------------------------------------------

-- A loss valued at nothing (an item never bought) is recorded, with no journal:
-- a journal of nothing cannot be published (D16).
create or replace function record_waste(p_item uuid, p_qty numeric, p_unit_code text, p_type movement_type,
                                        p_reason text, p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('waste.record');
  v_me uuid := (current_member()).id;
  v_location uuid; v_base numeric; v_cost numeric; v_value numeric; v_mv uuid; v_journal uuid;
begin
  if p_type not in ('waste', 'spoilage', 'expired', 'damaged', 'melt_evaporation',
                    'staff_consumption', 'complimentary', 'sampling') then
    raise exception 'Not a waste type: %', p_type;
  end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the stock was lost'; end if;
  if not exists (select 1 from item where id = p_item and business_id = v_business) then raise exception 'Unknown item'; end if;
  v_base := to_base_qty(p_item, p_qty, p_unit_code);
  if v_base is null or v_base <= 0 then raise exception 'Enter a quantity greater than zero'; end if;
  v_location := resolve_location(v_business, p_location);
  perform lock_items(array[p_item]);
  v_cost := item_issue_cost(v_business, p_item, v_location);
  v_value := money_round(v_business, v_cost * v_base);
  if v_value > (select waste_approval_threshold from business where id = v_business)
     and not current_has_permission('waste.approve') then
    -- Not saying the value: whoever lacks waste.approve may also lack cost.view.
    raise exception 'This much waste needs a manager to record it' using errcode = '42501';
  end if;

  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                  reference_type, app_user_id, reason, approval_status)
  values (v_business, p_item, v_location, p_type, -v_base, v_cost, v_value, 'waste', v_me, trim(p_reason),
          case when current_has_permission('waste.approve') then 'approved' else 'not_required' end::approval_status)
  returning id into v_mv;
  if v_value > 0 then
    v_journal := post_journal(v_business, now(), initcap(replace(p_type::text, '_', ' ')) || ': ' || trim(p_reason),
      'inventory_movement', v_mv,
      jsonb_build_array(jsonb_build_object('code', '5300', 'debit', v_value),
                        jsonb_build_object('code', '1200', 'credit', v_value)));
  end if;
  return jsonb_build_object('movement_id', v_mv,
    'journal_no', (select journal_no from journal_entry where id = v_journal))
    || case when current_has_permission('cost.view') then jsonb_build_object('value', v_value) else '{}' end;
end $$;

-- Cancelling a batch takes back what it made: refused once some of it has been
-- used or sold, which would leave stock below zero (D16). A loss or a
-- correction records what really happened instead.
create or replace function cancel_production(p_batch uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('inventory.adjust.approve');
  v_me uuid := (current_member()).id;
  b production_batch; m record; v_items uuid[]; v_on_hand numeric;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the batch is cancelled'; end if;
  select * into b from production_batch where id = p_batch and business_id = v_business for update;
  if not found then raise exception 'Batch not found'; end if;
  if b.status = 'cancelled' then raise exception 'This batch is already cancelled'; end if;
  if b.status <> 'completed' then raise exception 'Only a recorded batch can be cancelled'; end if;
  select array_agg(distinct item_id) into v_items from inventory_movement
   where reference_type = 'production_batch' and reference_id = p_batch;
  if v_items is not null then perform lock_items(v_items); end if;
  for m in select * from inventory_movement
            where reference_type = 'production_batch' and reference_id = p_batch
              and type = 'production_output' loop
    v_on_hand := (item_position(v_business, m.item_id, m.location_id)).qty;
    if v_on_hand < m.base_quantity_signed then
      raise exception 'Some of what this batch made has already been used or sold: record a loss or a correction instead';
    end if;
  end loop;
  for m in select * from inventory_movement
            where reference_type = 'production_batch' and reference_id = p_batch
              and type in ('production_consumption', 'production_output') loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason)
    values (v_business, m.item_id, m.location_id, 'reversal', -m.base_quantity_signed, m.unit_cost, m.value,
            'production_cancel', p_batch, v_me, 'Cancelled: ' || trim(p_reason));
  end loop;
  update production_batch set status = 'cancelled', cancelled_at = now(), cancelled_by = v_me,
                              cancel_reason = trim(p_reason)
   where id = p_batch;
  perform audit_event(v_business, 'production.cancel', 'production_batch', p_batch::text, trim(p_reason),
    jsonb_build_object('status', b.status), jsonb_build_object('status', 'cancelled'));
  return jsonb_build_object('batch_id', p_batch);
end $$;

-- Only the owner takes away the access of an owner or a general manager, as
-- only the owner appoints them (0016; D15).
create or replace function set_member_active(p_member uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage');
begin
  if p_member = current_app_user_id() then raise exception 'You cannot deactivate yourself'; end if;
  if exists (select 1 from user_role where app_user_id = p_member and role in ('owner', 'general_manager'))
     and not current_has_role('owner') then
    raise exception 'Only the owner can change the access of an owner or a general manager' using errcode = '42501';
  end if;
  if not p_active and exists (select 1 from user_role where app_user_id = p_member and role = 'owner')
     and (select count(*) from user_role ur join app_user au on au.id = ur.app_user_id
           where au.business_id = v_business and au.is_active and ur.role = 'owner') <= 1 then
    raise exception 'The business must keep at least one active owner';
  end if;
  update app_user set is_active = p_active where id = p_member and business_id = v_business;
  if not found then raise exception 'Member not found'; end if;
  perform audit_event(v_business, case when p_active then 'member.activate' else 'member.deactivate' end,
                      'app_user', p_member::text);
end $$;

-- Wrong PINs stop the person typing them, not the manager they name (D15):
-- 3 wrong in 15 minutes stops the requester for the rest of the 15. A
-- manager's approvals by PIN pause after 20 wrong PINs for them in a day, from
-- anyone, until they set a new PIN on My account.
create or replace function request_approval(p_kind text, p_approver uuid, p_pin text, p_scope jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  v_me uuid := (current_member()).id;
  v_perm text := approval_permission(p_kind);
  a app_user; v_mine int; v_day int; v_pin_set timestamptz; v_ok boolean; v_id uuid;
begin
  if v_perm is null then raise exception 'Unknown approval'; end if;
  select * into a from app_user where id = p_approver and business_id = v_business and is_active;
  if not found or not member_has_permission(a.id, v_perm) then
    raise exception 'Choose someone who may approve this';
  end if;
  if a.id = v_me then raise exception 'Someone else approves it: that is the point of asking'; end if;
  if a.pin_hash is null then
    return jsonb_build_object('ok', false, 'error', format('%s has not set a PIN yet (My account)', a.full_name));
  end if;
  select count(*) into v_mine from pin_attempt
   where business_id = v_business and requested_by = v_me and not ok and at > now() - interval '15 minutes';
  if v_mine >= 3 then
    return jsonb_build_object('ok', false,
      'error', 'Too many wrong PINs from this login: try again in 15 minutes');
  end if;
  select max(occurred_at) into v_pin_set from audit_log
   where business_id = v_business and action = 'member.pin_set' and entity_id = a.id::text;
  select count(*) into v_day from pin_attempt
   where approver_id = a.id and not ok
     and at > greatest(now() - interval '1 day', coalesce(v_pin_set, '-infinity'::timestamptz));
  if v_day >= 20 then
    return jsonb_build_object('ok', false,
      'error', format('Approvals by PIN are paused for %s after too many wrong PINs today: %s can set a new PIN on My account',
                      a.full_name, a.full_name));
  end if;
  v_ok := extensions.crypt(coalesce(p_pin, ''), a.pin_hash) = a.pin_hash;
  insert into pin_attempt (business_id, approver_id, requested_by, ok) values (v_business, a.id, v_me, v_ok);
  if not v_ok then
    perform audit_event(v_business, 'approval.refused', 'app_user', a.id::text, 'wrong PIN', null,
      jsonb_build_object('kind', p_kind, 'approver', a.id, 'requested_by', v_me));
    return jsonb_build_object('ok', false, 'error', 'That PIN is not right');
  end if;
  insert into approval (business_id, kind, approver_id, requested_by, scope, expires_at)
  values (v_business, p_kind, a.id, v_me, coalesce(p_scope, '{}'::jsonb), now() + interval '10 minutes')
  returning id into v_id;
  perform audit_event(v_business, 'approval.granted', 'approval', v_id::text, null, null,
    jsonb_build_object('kind', p_kind, 'approver', a.id, 'requested_by', v_me, 'scope', p_scope));
  return jsonb_build_object('ok', true, 'approval_id', v_id, 'approver', a.full_name);
end $$;

-- close_day has only raised an error since 0024 (the drawer count replaced it).
revoke execute on function close_day(date, numeric, numeric, uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- 3. The keyed versions (generated from the tested build's signatures)
-- ---------------------------------------------------------------------------
alter function add_delivery_platform(text, text, jsonb) rename to add_delivery_platform__run;
revoke execute on function add_delivery_platform__run(text, text, jsonb) from public, anon, authenticated;
create or replace function add_delivery_platform(
  p_name text,
  p_code text DEFAULT NULL::text,
  p_names jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_name', p_name, 'p_code', p_code, 'p_names', p_names);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'add_delivery_platform', v_req);
  if v is not null then return v; end if;
  v := add_delivery_platform__run(p_name => p_name, p_code => p_code, p_names => p_names);
  perform idem_finish(v_business, p_idempotency_key, 'add_delivery_platform', v_req, v);
  return v;
end $$;

alter function add_item_unit(uuid, text, text, numeric) rename to add_item_unit__run;
revoke execute on function add_item_unit__run(uuid, text, text, numeric) from public, anon, authenticated;
create or replace function add_item_unit(
  p_item uuid,
  p_code text,
  p_label text,
  p_factor numeric,
  p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_item', p_item, 'p_code', p_code, 'p_label', p_label, 'p_factor', p_factor);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'add_item_unit', v_req);
  if v is not null then return; end if;
  perform add_item_unit__run(p_item => p_item, p_code => p_code, p_label => p_label, p_factor => p_factor);
  perform idem_finish(v_business, p_idempotency_key, 'add_item_unit', v_req, 'null'::jsonb);
end $$;

alter function adjust_stock(uuid, numeric, text, text, numeric, uuid) rename to adjust_stock__run;
revoke execute on function adjust_stock__run(uuid, numeric, text, text, numeric, uuid) from public, anon, authenticated;
create or replace function adjust_stock(
  p_item uuid,
  p_delta numeric,
  p_unit_code text,
  p_reason text,
  p_unit_cost numeric DEFAULT NULL::numeric,
  p_location uuid DEFAULT NULL::uuid,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_item', p_item, 'p_delta', p_delta, 'p_unit_code', p_unit_code, 'p_reason', p_reason, 'p_unit_cost', p_unit_cost, 'p_location', p_location);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'adjust_stock', v_req);
  if v is not null then return v; end if;
  v := adjust_stock__run(p_item => p_item, p_delta => p_delta, p_unit_code => p_unit_code, p_reason => p_reason, p_unit_cost => p_unit_cost, p_location => p_location);
  perform idem_finish(v_business, p_idempotency_key, 'adjust_stock', v_req, v);
  return v;
end $$;

alter function approve_stock_count(uuid) rename to approve_stock_count__run;
revoke execute on function approve_stock_count__run(uuid) from public, anon, authenticated;
create or replace function approve_stock_count(
  p_count uuid,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_count', p_count);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'approve_stock_count', v_req);
  if v is not null then return v; end if;
  v := approve_stock_count__run(p_count => p_count);
  perform idem_finish(v_business, p_idempotency_key, 'approve_stock_count', v_req, v);
  return v;
end $$;

alter function cancel_bill(uuid, text, date) rename to cancel_bill__run;
revoke execute on function cancel_bill__run(uuid, text, date) from public, anon, authenticated;
create or replace function cancel_bill(
  p_bill uuid,
  p_reason text,
  p_date date DEFAULT NULL::date,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_bill', p_bill, 'p_reason', p_reason, 'p_date', p_date);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'cancel_bill', v_req);
  if v is not null then return v; end if;
  v := cancel_bill__run(p_bill => p_bill, p_reason => p_reason, p_date => p_date);
  perform idem_finish(v_business, p_idempotency_key, 'cancel_bill', v_req, v);
  return v;
end $$;

alter function cancel_card_settlement(uuid, text) rename to cancel_card_settlement__run;
revoke execute on function cancel_card_settlement__run(uuid, text) from public, anon, authenticated;
create or replace function cancel_card_settlement(
  p_settlement uuid,
  p_reason text,
  p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_settlement', p_settlement, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'cancel_card_settlement', v_req);
  if v is not null then return; end if;
  perform cancel_card_settlement__run(p_settlement => p_settlement, p_reason => p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'cancel_card_settlement', v_req, 'null'::jsonb);
end $$;

alter function cancel_platform_settlement(uuid, text) rename to cancel_platform_settlement__run;
revoke execute on function cancel_platform_settlement__run(uuid, text) from public, anon, authenticated;
create or replace function cancel_platform_settlement(
  p_settlement uuid,
  p_reason text,
  p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_settlement', p_settlement, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'cancel_platform_settlement', v_req);
  if v is not null then return; end if;
  perform cancel_platform_settlement__run(p_settlement => p_settlement, p_reason => p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'cancel_platform_settlement', v_req, 'null'::jsonb);
end $$;

alter function cancel_production(uuid, text) rename to cancel_production__run;
revoke execute on function cancel_production__run(uuid, text) from public, anon, authenticated;
create or replace function cancel_production(
  p_batch uuid,
  p_reason text,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_batch', p_batch, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'cancel_production', v_req);
  if v is not null then return v; end if;
  v := cancel_production__run(p_batch => p_batch, p_reason => p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'cancel_production', v_req, v);
  return v;
end $$;

alter function cancel_scheduled_price(uuid, text) rename to cancel_scheduled_price__run;
revoke execute on function cancel_scheduled_price__run(uuid, text) from public, anon, authenticated;
create or replace function cancel_scheduled_price(
  p_price uuid,
  p_reason text,
  p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_price', p_price, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'cancel_scheduled_price', v_req);
  if v is not null then return; end if;
  perform cancel_scheduled_price__run(p_price => p_price, p_reason => p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'cancel_scheduled_price', v_req, 'null'::jsonb);
end $$;

alter function cancel_scheduled_recipe(uuid, text) rename to cancel_scheduled_recipe__run;
revoke execute on function cancel_scheduled_recipe__run(uuid, text) from public, anon, authenticated;
create or replace function cancel_scheduled_recipe(
  p_version uuid,
  p_reason text,
  p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_version', p_version, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'cancel_scheduled_recipe', v_req);
  if v is not null then return; end if;
  perform cancel_scheduled_recipe__run(p_version => p_version, p_reason => p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'cancel_scheduled_recipe', v_req, 'null'::jsonb);
end $$;

alter function cancel_stock_count(uuid, text) rename to cancel_stock_count__run;
revoke execute on function cancel_stock_count__run(uuid, text) from public, anon, authenticated;
create or replace function cancel_stock_count(
  p_count uuid,
  p_reason text,
  p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_count', p_count, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'cancel_stock_count', v_req);
  if v is not null then return; end if;
  perform cancel_stock_count__run(p_count => p_count, p_reason => p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'cancel_stock_count', v_req, 'null'::jsonb);
end $$;

alter function cancel_tab(uuid, integer, text, text) rename to cancel_tab__run;
revoke execute on function cancel_tab__run(uuid, integer, text, text) from public, anon, authenticated;
create or replace function cancel_tab(
  p_tab uuid,
  p_version integer,
  p_reason text DEFAULT NULL::text,
  p_reason_code text DEFAULT NULL::text,
  p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_tab', p_tab, 'p_version', p_version, 'p_reason', p_reason, 'p_reason_code', p_reason_code);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'cancel_tab', v_req);
  if v is not null then return; end if;
  perform cancel_tab__run(p_tab => p_tab, p_version => p_version, p_reason => p_reason, p_reason_code => p_reason_code);
  perform idem_finish(v_business, p_idempotency_key, 'cancel_tab', v_req, 'null'::jsonb);
end $$;

alter function change_product_recipe(uuid, jsonb, date) rename to change_product_recipe__run;
revoke execute on function change_product_recipe__run(uuid, jsonb, date) from public, anon, authenticated;
create or replace function change_product_recipe(
  p_variant uuid,
  p_lines jsonb,
  p_effective_from date DEFAULT NULL::date,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_variant', p_variant, 'p_lines', p_lines, 'p_effective_from', p_effective_from);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'change_product_recipe', v_req);
  if v is not null then return v; end if;
  v := change_product_recipe__run(p_variant => p_variant, p_lines => p_lines, p_effective_from => p_effective_from);
  perform idem_finish(v_business, p_idempotency_key, 'change_product_recipe', v_req, v);
  return v;
end $$;

alter function copy_platform_setup(text, text, boolean) rename to copy_platform_setup__run;
revoke execute on function copy_platform_setup__run(text, text, boolean) from public, anon, authenticated;
create or replace function copy_platform_setup(
  p_platform text,
  p_like text,
  p_prices boolean DEFAULT true,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_platform', p_platform, 'p_like', p_like, 'p_prices', p_prices);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'copy_platform_setup', v_req);
  if v is not null then return v; end if;
  v := copy_platform_setup__run(p_platform => p_platform, p_like => p_like, p_prices => p_prices);
  perform idem_finish(v_business, p_idempotency_key, 'copy_platform_setup', v_req, v);
  return v;
end $$;

alter function count_drawer(numeric, numeric, text, numeric, uuid) rename to count_drawer__run;
revoke execute on function count_drawer__run(numeric, numeric, text, numeric, uuid) from public, anon, authenticated;
create or replace function count_drawer(
  p_counted numeric,
  p_left_in_drawer numeric DEFAULT NULL::numeric,
  p_take_to text DEFAULT NULL::text,
  p_start_cash numeric DEFAULT NULL::numeric,
  p_location uuid DEFAULT NULL::uuid,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_counted', p_counted, 'p_left_in_drawer', p_left_in_drawer, 'p_take_to', p_take_to, 'p_start_cash', p_start_cash, 'p_location', p_location);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'count_drawer', v_req);
  if v is not null then return v; end if;
  v := count_drawer__run(p_counted => p_counted, p_left_in_drawer => p_left_in_drawer, p_take_to => p_take_to, p_start_cash => p_start_cash, p_location => p_location);
  perform idem_finish(v_business, p_idempotency_key, 'count_drawer', v_req, v);
  return v;
end $$;

alter function create_item(text, item_type, text, unit_dimension, text, text, numeric, jsonb, numeric, numeric, boolean, text) rename to create_item__run;
revoke execute on function create_item__run(text, item_type, text, unit_dimension, text, text, numeric, jsonb, numeric, numeric, boolean, text) from public, anon, authenticated;
create or replace function create_item(
  p_name text,
  p_item_type item_type,
  p_base_unit text,
  p_dimension unit_dimension,
  p_name_ar text DEFAULT NULL::text,
  p_name_ckb text DEFAULT NULL::text,
  p_min_level numeric DEFAULT NULL::numeric,
  p_units jsonb DEFAULT '[]'::jsonb,
  p_opening_qty numeric DEFAULT NULL::numeric,
  p_opening_unit_cost numeric DEFAULT NULL::numeric,
  p_returnable boolean DEFAULT false,
  p_opening_reason text DEFAULT NULL::text,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_name', p_name, 'p_item_type', p_item_type, 'p_base_unit', p_base_unit, 'p_dimension', p_dimension, 'p_name_ar', p_name_ar, 'p_name_ckb', p_name_ckb, 'p_min_level', p_min_level, 'p_units', p_units, 'p_opening_qty', p_opening_qty, 'p_opening_unit_cost', p_opening_unit_cost, 'p_returnable', p_returnable, 'p_opening_reason', p_opening_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'create_item', v_req);
  if v is not null then return v; end if;
  v := create_item__run(p_name => p_name, p_item_type => p_item_type, p_base_unit => p_base_unit, p_dimension => p_dimension, p_name_ar => p_name_ar, p_name_ckb => p_name_ckb, p_min_level => p_min_level, p_units => p_units, p_opening_qty => p_opening_qty, p_opening_unit_cost => p_opening_unit_cost, p_returnable => p_returnable, p_opening_reason => p_opening_reason);
  perform idem_finish(v_business, p_idempotency_key, 'create_item', v_req, v);
  return v;
end $$;

alter function create_product(text, jsonb, jsonb, text, text, uuid, text) rename to create_product__run;
revoke execute on function create_product__run(text, jsonb, jsonb, text, text, uuid, text) from public, anon, authenticated;
create or replace function create_product(
  p_name text,
  p_prices jsonb,
  p_recipe jsonb DEFAULT '[]'::jsonb,
  p_name_ar text DEFAULT NULL::text,
  p_name_ckb text DEFAULT NULL::text,
  p_category uuid DEFAULT NULL::uuid,
  p_no_stock_reason text DEFAULT NULL::text,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_name', p_name, 'p_prices', p_prices, 'p_recipe', p_recipe, 'p_name_ar', p_name_ar, 'p_name_ckb', p_name_ckb, 'p_category', p_category, 'p_no_stock_reason', p_no_stock_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'create_product', v_req);
  if v is not null then return v; end if;
  v := create_product__run(p_name => p_name, p_prices => p_prices, p_recipe => p_recipe, p_name_ar => p_name_ar, p_name_ckb => p_name_ckb, p_category => p_category, p_no_stock_reason => p_no_stock_reason);
  perform idem_finish(v_business, p_idempotency_key, 'create_product', v_req, v);
  return v;
end $$;

alter function create_supplier(text, text, text) rename to create_supplier__run;
revoke execute on function create_supplier__run(text, text, text) from public, anon, authenticated;
create or replace function create_supplier(
  p_name text,
  p_contact text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text,
  p_idempotency_key uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_name', p_name, 'p_contact', p_contact, 'p_phone', p_phone);
  v jsonb;
  v_id uuid;
begin
  v := idem_begin(v_business, p_idempotency_key, 'create_supplier', v_req);
  if v is not null then return (v #>> '{}')::uuid; end if;
  v_id := create_supplier__run(p_name => p_name, p_contact => p_contact, p_phone => p_phone);
  perform idem_finish(v_business, p_idempotency_key, 'create_supplier', v_req, to_jsonb(v_id));
  return v_id;
end $$;

alter function discard_journal(uuid) rename to discard_journal__run;
revoke execute on function discard_journal__run(uuid) from public, anon, authenticated;
create or replace function discard_journal(
  p_entry uuid,
  p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_entry', p_entry);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'discard_journal', v_req);
  if v is not null then return; end if;
  perform discard_journal__run(p_entry => p_entry);
  perform audit_event(v_business, 'journal.discard', 'journal_entry', p_entry::text, null, null,
    null);
  perform idem_finish(v_business, p_idempotency_key, 'discard_journal', v_req, 'null'::jsonb);
end $$;

alter function invite_member(text, text, app_role[]) rename to invite_member__run;
revoke execute on function invite_member__run(text, text, app_role[]) from public, anon, authenticated;
create or replace function invite_member(
  p_email text,
  p_name text,
  p_roles app_role[],
  p_idempotency_key uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_email', p_email, 'p_name', p_name, 'p_roles', p_roles);
  v jsonb;
  v_id uuid;
begin
  v := idem_begin(v_business, p_idempotency_key, 'invite_member', v_req);
  if v is not null then return (v #>> '{}')::uuid; end if;
  v_id := invite_member__run(p_email => p_email, p_name => p_name, p_roles => p_roles);
  perform idem_finish(v_business, p_idempotency_key, 'invite_member', v_req, to_jsonb(v_id));
  return v_id;
end $$;

alter function lock_period(uuid, text) rename to lock_period__run;
revoke execute on function lock_period__run(uuid, text) from public, anon, authenticated;
create or replace function lock_period(
  p_period uuid,
  p_reason text DEFAULT NULL::text,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_period', p_period, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'lock_period', v_req);
  if v is not null then return v; end if;
  v := lock_period__run(p_period => p_period, p_reason => p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'lock_period', v_req, v);
  return v;
end $$;

alter function mark_bill_printed(uuid, integer) rename to mark_bill_printed__run;
revoke execute on function mark_bill_printed__run(uuid, integer) from public, anon, authenticated;
create or replace function mark_bill_printed(
  p_tab uuid,
  p_version integer,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_tab', p_tab, 'p_version', p_version);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'mark_bill_printed', v_req);
  if v is not null then return v; end if;
  v := mark_bill_printed__run(p_tab => p_tab, p_version => p_version);
  perform idem_finish(v_business, p_idempotency_key, 'mark_bill_printed', v_req, v);
  return v;
end $$;

alter function move_cash(text, text, numeric, text, uuid) rename to move_cash__run;
revoke execute on function move_cash__run(text, text, numeric, text, uuid) from public, anon, authenticated;
create or replace function move_cash(
  p_from text,
  p_to text,
  p_amount numeric,
  p_note text DEFAULT NULL::text,
  p_location uuid DEFAULT NULL::uuid,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_from', p_from, 'p_to', p_to, 'p_amount', p_amount, 'p_note', p_note, 'p_location', p_location);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'move_cash', v_req);
  if v is not null then return v; end if;
  v := move_cash__run(p_from => p_from, p_to => p_to, p_amount => p_amount, p_note => p_note, p_location => p_location);
  perform idem_finish(v_business, p_idempotency_key, 'move_cash', v_req, v);
  return v;
end $$;

alter function open_tab(sales_channel, uuid, text, uuid, jsonb, numeric, numeric, text, text, uuid) rename to open_tab__run;
revoke execute on function open_tab__run(sales_channel, uuid, text, uuid, jsonb, numeric, numeric, text, text, uuid) from public, anon, authenticated;
create or replace function open_tab(
  p_channel sales_channel,
  p_table uuid DEFAULT NULL::uuid,
  p_label text DEFAULT NULL::text,
  p_location uuid DEFAULT NULL::uuid,
  p_lines jsonb DEFAULT NULL::jsonb,
  p_discount_percent numeric DEFAULT NULL::numeric,
  p_discount_amount numeric DEFAULT NULL::numeric,
  p_discount_reason text DEFAULT NULL::text,
  p_discount_note text DEFAULT NULL::text,
  p_approval uuid DEFAULT NULL::uuid,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_channel', p_channel, 'p_table', p_table, 'p_label', p_label, 'p_location', p_location, 'p_lines', p_lines, 'p_discount_percent', p_discount_percent, 'p_discount_amount', p_discount_amount, 'p_discount_reason', p_discount_reason, 'p_discount_note', p_discount_note, 'p_approval', p_approval);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'open_tab', v_req);
  if v is not null then return v; end if;
  v := open_tab__run(p_channel => p_channel, p_table => p_table, p_label => p_label, p_location => p_location, p_lines => p_lines, p_discount_percent => p_discount_percent, p_discount_amount => p_discount_amount, p_discount_reason => p_discount_reason, p_discount_note => p_discount_note, p_approval => p_approval);
  perform idem_finish(v_business, p_idempotency_key, 'open_tab', v_req, v);
  return v;
end $$;

alter function pay_bill(uuid, numeric, text) rename to pay_bill__run;
revoke execute on function pay_bill__run(uuid, numeric, text) from public, anon, authenticated;
create or replace function pay_bill(
  p_bill uuid,
  p_amount numeric,
  p_method text,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_bill', p_bill, 'p_amount', p_amount, 'p_method', p_method);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'pay_bill', v_req);
  if v is not null then return v; end if;
  v := pay_bill__run(p_bill => p_bill, p_amount => p_amount, p_method => p_method);
  perform audit_event(v_business, 'purchase.pay', 'purchase_invoice', p_bill::text, null, null,
    jsonb_build_object('invoice_no', (select invoice_no from purchase_invoice where id = p_bill), 'amount', p_amount, 'paid_from', p_method));
  perform idem_finish(v_business, p_idempotency_key, 'pay_bill', v_req, v);
  return v;
end $$;

alter function post_control_correction(date, text, jsonb, text) rename to post_control_correction__run;
revoke execute on function post_control_correction__run(date, text, jsonb, text) from public, anon, authenticated;
create or replace function post_control_correction(
  p_date date,
  p_description text,
  p_lines jsonb,
  p_reason text,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_date', p_date, 'p_description', p_description, 'p_lines', p_lines, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'post_control_correction', v_req);
  if v is not null then return v; end if;
  v := post_control_correction__run(p_date => p_date, p_description => p_description, p_lines => p_lines, p_reason => p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'post_control_correction', v_req, v);
  return v;
end $$;

alter function post_legacy_unposted(text) rename to post_legacy_unposted__run;
revoke execute on function post_legacy_unposted__run(text) from public, anon, authenticated;
create or replace function post_legacy_unposted(
  p_reason text,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'post_legacy_unposted', v_req);
  if v is not null then return v; end if;
  v := post_legacy_unposted__run(p_reason => p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'post_legacy_unposted', v_req, v);
  return v;
end $$;

alter function post_platform_settlement(text, text, jsonb, date, text) rename to post_platform_settlement__run;
revoke execute on function post_platform_settlement__run(text, text, jsonb, date, text) from public, anon, authenticated;
create or replace function post_platform_settlement(
  p_platform text,
  p_reference text,
  p_lines jsonb,
  p_received_on date DEFAULT NULL::date,
  p_note text DEFAULT NULL::text,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_platform', p_platform, 'p_reference', p_reference, 'p_lines', p_lines, 'p_received_on', p_received_on, 'p_note', p_note);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'post_platform_settlement', v_req);
  if v is not null then return v; end if;
  v := post_platform_settlement__run(p_platform => p_platform, p_reference => p_reference, p_lines => p_lines, p_received_on => p_received_on, p_note => p_note);
  perform idem_finish(v_business, p_idempotency_key, 'post_platform_settlement', v_req, v);
  return v;
end $$;

alter function publish_journal(uuid) rename to publish_journal__run;
revoke execute on function publish_journal__run(uuid) from public, anon, authenticated;
create or replace function publish_journal(
  p_entry uuid,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_entry', p_entry);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'publish_journal', v_req);
  if v is not null then return v; end if;
  v := publish_journal__run(p_entry => p_entry);
  perform audit_event(v_business, 'journal.publish', 'journal_entry', p_entry::text, null, null,
    jsonb_build_object('journal_no', v->'journal_no'));
  perform idem_finish(v_business, p_idempotency_key, 'publish_journal', v_req, v);
  return v;
end $$;

alter function receive_goods(uuid, jsonb, numeric, numeric, numeric, text, uuid, boolean) rename to receive_goods__run;
revoke execute on function receive_goods__run(uuid, jsonb, numeric, numeric, numeric, text, uuid, boolean) from public, anon, authenticated;
create or replace function receive_goods(
  p_supplier uuid,
  p_lines jsonb,
  p_freight numeric DEFAULT 0,
  p_other numeric DEFAULT 0,
  p_rebate numeric DEFAULT 0,
  p_note text DEFAULT NULL::text,
  p_location uuid DEFAULT NULL::uuid,
  p_confirm boolean DEFAULT false,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_supplier', p_supplier, 'p_lines', p_lines, 'p_freight', p_freight, 'p_other', p_other, 'p_rebate', p_rebate, 'p_note', p_note, 'p_location', p_location, 'p_confirm', p_confirm);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'receive_goods', v_req);
  if v is not null then return v; end if;
  v := receive_goods__run(p_supplier => p_supplier, p_lines => p_lines, p_freight => p_freight, p_other => p_other, p_rebate => p_rebate, p_note => p_note, p_location => p_location, p_confirm => p_confirm);
  perform audit_event(v_business, 'purchase.receive', 'goods_receipt', v->>'receipt_id', null, null,
    jsonb_build_object('receipt_no', v->'receipt_no', 'supplier', p_supplier, 'items', p_lines, 'value', v->'value'));
  perform idem_finish(v_business, p_idempotency_key, 'receive_goods', v_req, v);
  return v;
end $$;

alter function record_bill(uuid, text, date, numeric, integer, uuid, text) rename to record_bill__run;
revoke execute on function record_bill__run(uuid, text, date, numeric, integer, uuid, text) from public, anon, authenticated;
create or replace function record_bill(
  p_supplier uuid,
  p_invoice_no text,
  p_invoice_date date,
  p_amount numeric,
  p_term_days integer DEFAULT 0,
  p_receipt uuid DEFAULT NULL::uuid,
  p_account_code text DEFAULT NULL::text,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_supplier', p_supplier, 'p_invoice_no', p_invoice_no, 'p_invoice_date', p_invoice_date, 'p_amount', p_amount, 'p_term_days', p_term_days, 'p_receipt', p_receipt, 'p_account_code', p_account_code);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_bill', v_req);
  if v is not null then return v; end if;
  v := record_bill__run(p_supplier => p_supplier, p_invoice_no => p_invoice_no, p_invoice_date => p_invoice_date, p_amount => p_amount, p_term_days => p_term_days, p_receipt => p_receipt, p_account_code => p_account_code);
  perform audit_event(v_business, 'purchase.bill', 'purchase_invoice', v->>'bill_id', null, null,
    jsonb_build_object('invoice_no', v->'invoice_no', 'supplier', p_supplier, 'amount', p_amount, 'receipt_no', (select receipt_no from goods_receipt where id = p_receipt), 'account', p_account_code));
  perform idem_finish(v_business, p_idempotency_key, 'record_bill', v_req, v);
  return v;
end $$;

alter function record_card_settlement(date, numeric, numeric, date, text, text) rename to record_card_settlement__run;
revoke execute on function record_card_settlement__run(date, numeric, numeric, date, text, text) from public, anon, authenticated;
create or replace function record_card_settlement(
  p_through date,
  p_terminal_total numeric,
  p_received numeric,
  p_received_on date DEFAULT NULL::date,
  p_reference text DEFAULT NULL::text,
  p_note text DEFAULT NULL::text,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_through', p_through, 'p_terminal_total', p_terminal_total, 'p_received', p_received, 'p_received_on', p_received_on, 'p_reference', p_reference, 'p_note', p_note);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_card_settlement', v_req);
  if v is not null then return v; end if;
  v := record_card_settlement__run(p_through => p_through, p_terminal_total => p_terminal_total, p_received => p_received, p_received_on => p_received_on, p_reference => p_reference, p_note => p_note);
  perform idem_finish(v_business, p_idempotency_key, 'record_card_settlement', v_req, v);
  return v;
end $$;

alter function record_expense(text, numeric, text, text, date) rename to record_expense__run;
revoke execute on function record_expense__run(text, numeric, text, text, date) from public, anon, authenticated;
create or replace function record_expense(
  p_description text,
  p_amount numeric,
  p_account_code text,
  p_paid_from text DEFAULT 'cash'::text,
  p_date date DEFAULT NULL::date,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_description', p_description, 'p_amount', p_amount, 'p_account_code', p_account_code, 'p_paid_from', p_paid_from, 'p_date', p_date);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_expense', v_req);
  if v is not null then return v; end if;
  v := record_expense__run(p_description => p_description, p_amount => p_amount, p_account_code => p_account_code, p_paid_from => p_paid_from, p_date => p_date);
  perform audit_event(v_business, 'expense.record', 'expense', v->>'expense_id', null, null,
    jsonb_build_object('description', p_description, 'amount', p_amount, 'account', p_account_code, 'paid_from', p_paid_from, 'journal_no', v->'journal_no'));
  perform idem_finish(v_business, p_idempotency_key, 'record_expense', v_req, v);
  return v;
end $$;

alter function record_opening_stock(uuid, numeric, text, numeric, text, uuid) rename to record_opening_stock__run;
revoke execute on function record_opening_stock__run(uuid, numeric, text, numeric, text, uuid) from public, anon, authenticated;
create or replace function record_opening_stock(
  p_item uuid,
  p_qty numeric,
  p_unit_code text,
  p_unit_cost numeric,
  p_reason text,
  p_location uuid DEFAULT NULL::uuid,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_item', p_item, 'p_qty', p_qty, 'p_unit_code', p_unit_code, 'p_unit_cost', p_unit_cost, 'p_reason', p_reason, 'p_location', p_location);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_opening_stock', v_req);
  if v is not null then return v; end if;
  v := record_opening_stock__run(p_item => p_item, p_qty => p_qty, p_unit_code => p_unit_code, p_unit_cost => p_unit_cost, p_reason => p_reason, p_location => p_location);
  perform idem_finish(v_business, p_idempotency_key, 'record_opening_stock', v_req, v);
  return v;
end $$;

alter function record_production(uuid, numeric, numeric, text, text, uuid) rename to record_production__run;
revoke execute on function record_production__run(uuid, numeric, numeric, text, text, uuid) from public, anon, authenticated;
create or replace function record_production(
  p_recipe uuid,
  p_batches numeric DEFAULT 1,
  p_output_qty numeric DEFAULT NULL::numeric,
  p_output_unit text DEFAULT NULL::text,
  p_note text DEFAULT NULL::text,
  p_location uuid DEFAULT NULL::uuid,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_recipe', p_recipe, 'p_batches', p_batches, 'p_output_qty', p_output_qty, 'p_output_unit', p_output_unit, 'p_note', p_note, 'p_location', p_location);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_production', v_req);
  if v is not null then return v; end if;
  v := record_production__run(p_recipe => p_recipe, p_batches => p_batches, p_output_qty => p_output_qty, p_output_unit => p_output_unit, p_note => p_note, p_location => p_location);
  perform audit_event(v_business, 'production.record', 'production_batch', v->>'batch_id', null, null,
    jsonb_build_object('recipe', (select name from recipe where id = p_recipe), 'batches', p_batches, 'qty', p_output_qty, 'unit', p_output_unit, 'note', p_note));
  perform idem_finish(v_business, p_idempotency_key, 'record_production', v_req, v);
  return v;
end $$;

alter function record_waste(uuid, numeric, text, movement_type, text, uuid) rename to record_waste__run;
revoke execute on function record_waste__run(uuid, numeric, text, movement_type, text, uuid) from public, anon, authenticated;
create or replace function record_waste(
  p_item uuid,
  p_qty numeric,
  p_unit_code text,
  p_type movement_type,
  p_reason text,
  p_location uuid DEFAULT NULL::uuid,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_item', p_item, 'p_qty', p_qty, 'p_unit_code', p_unit_code, 'p_type', p_type, 'p_reason', p_reason, 'p_location', p_location);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_waste', v_req);
  if v is not null then return v; end if;
  v := record_waste__run(p_item => p_item, p_qty => p_qty, p_unit_code => p_unit_code, p_type => p_type, p_reason => p_reason, p_location => p_location);
  perform audit_event(v_business, 'inventory.waste', 'inventory_movement', v->>'movement_id', p_reason, null,
    jsonb_build_object('item', p_item, 'movement', p_type, 'qty', p_qty, 'unit', p_unit_code, 'value', v->'value'));
  perform idem_finish(v_business, p_idempotency_key, 'record_waste', v_req, v);
  return v;
end $$;

alter function refund_sale(uuid, text, text, uuid) rename to refund_sale__run;
revoke execute on function refund_sale__run(uuid, text, text, uuid) from public, anon, authenticated;
create or replace function refund_sale(
  p_order uuid,
  p_reason text DEFAULT NULL::text,
  p_reason_code text DEFAULT NULL::text,
  p_approval uuid DEFAULT NULL::uuid,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_order', p_order, 'p_reason', p_reason, 'p_reason_code', p_reason_code, 'p_approval', p_approval);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'refund_sale', v_req);
  if v is not null then return v; end if;
  v := refund_sale__run(p_order => p_order, p_reason => p_reason, p_reason_code => p_reason_code, p_approval => p_approval);
  perform idem_finish(v_business, p_idempotency_key, 'refund_sale', v_req, v);
  return v;
end $$;

alter function reject_stock_count(uuid, text) rename to reject_stock_count__run;
revoke execute on function reject_stock_count__run(uuid, text) from public, anon, authenticated;
create or replace function reject_stock_count(
  p_count uuid,
  p_reason text,
  p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_count', p_count, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'reject_stock_count', v_req);
  if v is not null then return; end if;
  perform reject_stock_count__run(p_count => p_count, p_reason => p_reason);
  perform audit_event(v_business, 'inventory.count.reject', 'stock_count', p_count::text, p_reason, null,
    null);
  perform idem_finish(v_business, p_idempotency_key, 'reject_stock_count', v_req, 'null'::jsonb);
end $$;

alter function reverse_journal(uuid, text, date) rename to reverse_journal__run;
revoke execute on function reverse_journal__run(uuid, text, date) from public, anon, authenticated;
create or replace function reverse_journal(
  p_entry uuid,
  p_reason text,
  p_date date DEFAULT NULL::date,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_entry', p_entry, 'p_reason', p_reason, 'p_date', p_date);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'reverse_journal', v_req);
  if v is not null then return v; end if;
  v := reverse_journal__run(p_entry => p_entry, p_reason => p_reason, p_date => p_date);
  perform idem_finish(v_business, p_idempotency_key, 'reverse_journal', v_req, v);
  return v;
end $$;

alter function save_batch_recipe(uuid, text, jsonb, numeric, text, jsonb, text, boolean) rename to save_batch_recipe__run;
revoke execute on function save_batch_recipe__run(uuid, text, jsonb, numeric, text, jsonb, text, boolean) from public, anon, authenticated;
create or replace function save_batch_recipe(
  p_recipe uuid,
  p_name text,
  p_output jsonb,
  p_yield numeric,
  p_yield_unit text,
  p_lines jsonb,
  p_instructions text DEFAULT NULL::text,
  p_is_active boolean DEFAULT true,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_recipe', p_recipe, 'p_name', p_name, 'p_output', p_output, 'p_yield', p_yield, 'p_yield_unit', p_yield_unit, 'p_lines', p_lines, 'p_instructions', p_instructions, 'p_is_active', p_is_active);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_batch_recipe', v_req);
  if v is not null then return v; end if;
  v := save_batch_recipe__run(p_recipe => p_recipe, p_name => p_name, p_output => p_output, p_yield => p_yield, p_yield_unit => p_yield_unit, p_lines => p_lines, p_instructions => p_instructions, p_is_active => p_is_active);
  perform idem_finish(v_business, p_idempotency_key, 'save_batch_recipe', v_req, v);
  return v;
end $$;

alter function save_category(uuid, text, text, text, integer, boolean) rename to save_category__run;
revoke execute on function save_category__run(uuid, text, text, text, integer, boolean) from public, anon, authenticated;
create or replace function save_category(
  p_id uuid,
  p_name text,
  p_name_ar text DEFAULT NULL::text,
  p_name_ckb text DEFAULT NULL::text,
  p_sort_order integer DEFAULT 0,
  p_is_active boolean DEFAULT true,
  p_idempotency_key uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_id', p_id, 'p_name', p_name, 'p_name_ar', p_name_ar, 'p_name_ckb', p_name_ckb, 'p_sort_order', p_sort_order, 'p_is_active', p_is_active);
  v jsonb;
  v_id uuid;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_category', v_req);
  if v is not null then return (v #>> '{}')::uuid; end if;
  v_id := save_category__run(p_id => p_id, p_name => p_name, p_name_ar => p_name_ar, p_name_ckb => p_name_ckb, p_sort_order => p_sort_order, p_is_active => p_is_active);
  perform idem_finish(v_business, p_idempotency_key, 'save_category', v_req, to_jsonb(v_id));
  return v_id;
end $$;

alter function save_journal(date, text, jsonb, boolean, text, date) rename to save_journal__run;
revoke execute on function save_journal__run(date, text, jsonb, boolean, text, date) from public, anon, authenticated;
create or replace function save_journal(
  p_date date,
  p_description text,
  p_lines jsonb,
  p_publish boolean,
  p_reference_no text DEFAULT NULL::text,
  p_reverse_on date DEFAULT NULL::date,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_date', p_date, 'p_description', p_description, 'p_lines', p_lines, 'p_publish', p_publish, 'p_reference_no', p_reference_no, 'p_reverse_on', p_reverse_on);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_journal', v_req);
  if v is not null then return v; end if;
  v := save_journal__run(p_date => p_date, p_description => p_description, p_lines => p_lines, p_publish => p_publish, p_reference_no => p_reference_no, p_reverse_on => p_reverse_on);
  perform audit_event(v_business, 'journal.save', 'journal_entry', v->>'id', null, null,
    jsonb_build_object('description', p_description, 'journal_no', v->'journal_no'));
  perform idem_finish(v_business, p_idempotency_key, 'save_journal', v_req, v);
  return v;
end $$;

alter function save_tab(uuid, integer, jsonb, text, uuid, numeric, numeric, text, text, uuid) rename to save_tab__run;
revoke execute on function save_tab__run(uuid, integer, jsonb, text, uuid, numeric, numeric, text, text, uuid) from public, anon, authenticated;
create or replace function save_tab(
  p_tab uuid,
  p_version integer,
  p_lines jsonb,
  p_label text DEFAULT NULL::text,
  p_table uuid DEFAULT NULL::uuid,
  p_discount_percent numeric DEFAULT NULL::numeric,
  p_discount_amount numeric DEFAULT NULL::numeric,
  p_discount_reason text DEFAULT NULL::text,
  p_discount_note text DEFAULT NULL::text,
  p_approval uuid DEFAULT NULL::uuid,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_tab', p_tab, 'p_version', p_version, 'p_lines', p_lines, 'p_label', p_label, 'p_table', p_table, 'p_discount_percent', p_discount_percent, 'p_discount_amount', p_discount_amount, 'p_discount_reason', p_discount_reason, 'p_discount_note', p_discount_note, 'p_approval', p_approval);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_tab', v_req);
  if v is not null then return v; end if;
  v := save_tab__run(p_tab => p_tab, p_version => p_version, p_lines => p_lines, p_label => p_label, p_table => p_table, p_discount_percent => p_discount_percent, p_discount_amount => p_discount_amount, p_discount_reason => p_discount_reason, p_discount_note => p_discount_note, p_approval => p_approval);
  perform idem_finish(v_business, p_idempotency_key, 'save_tab', v_req, v);
  return v;
end $$;

alter function save_table(uuid, text, text, integer, integer, boolean, uuid) rename to save_table__run;
revoke execute on function save_table__run(uuid, text, text, integer, integer, boolean, uuid) from public, anon, authenticated;
create or replace function save_table(
  p_id uuid,
  p_name text,
  p_area text DEFAULT NULL::text,
  p_seats integer DEFAULT NULL::integer,
  p_sort_order integer DEFAULT 0,
  p_is_active boolean DEFAULT true,
  p_location uuid DEFAULT NULL::uuid,
  p_idempotency_key uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_id', p_id, 'p_name', p_name, 'p_area', p_area, 'p_seats', p_seats, 'p_sort_order', p_sort_order, 'p_is_active', p_is_active, 'p_location', p_location);
  v jsonb;
  v_id uuid;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_table', v_req);
  if v is not null then return (v #>> '{}')::uuid; end if;
  v_id := save_table__run(p_id => p_id, p_name => p_name, p_area => p_area, p_seats => p_seats, p_sort_order => p_sort_order, p_is_active => p_is_active, p_location => p_location);
  perform audit_event(v_business, 'table.save', 'dining_table', v_id::text, null, null,
    jsonb_build_object('name', p_name, 'area', p_area, 'seats', p_seats, 'is_active', p_is_active));
  perform idem_finish(v_business, p_idempotency_key, 'save_table', v_req, to_jsonb(v_id));
  return v_id;
end $$;

alter function set_price(uuid, sales_channel, numeric, date) rename to set_price__run;
revoke execute on function set_price__run(uuid, sales_channel, numeric, date) from public, anon, authenticated;
create or replace function set_price(
  p_variant uuid,
  p_channel sales_channel,
  p_price numeric,
  p_effective_from date DEFAULT NULL::date,
  p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_variant', p_variant, 'p_channel', p_channel, 'p_price', p_price, 'p_effective_from', p_effective_from);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_price', v_req);
  if v is not null then return; end if;
  perform set_price__run(p_variant => p_variant, p_channel => p_channel, p_price => p_price, p_effective_from => p_effective_from);
  perform idem_finish(v_business, p_idempotency_key, 'set_price', v_req, 'null'::jsonb);
end $$;

alter function split_tab(uuid, integer, jsonb, text) rename to split_tab__run;
revoke execute on function split_tab__run(uuid, integer, jsonb, text) from public, anon, authenticated;
create or replace function split_tab(
  p_tab uuid,
  p_version integer,
  p_move jsonb,
  p_label text DEFAULT NULL::text,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_tab', p_tab, 'p_version', p_version, 'p_move', p_move, 'p_label', p_label);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'split_tab', v_req);
  if v is not null then return v; end if;
  v := split_tab__run(p_tab => p_tab, p_version => p_version, p_move => p_move, p_label => p_label);
  perform idem_finish(v_business, p_idempotency_key, 'split_tab', v_req, v);
  return v;
end $$;

alter function start_stock_count(uuid[], uuid) rename to start_stock_count__run;
revoke execute on function start_stock_count__run(uuid[], uuid) from public, anon, authenticated;
create or replace function start_stock_count(
  p_items uuid[] DEFAULT NULL::uuid[],
  p_location uuid DEFAULT NULL::uuid,
  p_idempotency_key uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_items', p_items, 'p_location', p_location);
  v jsonb;
  v_id uuid;
begin
  v := idem_begin(v_business, p_idempotency_key, 'start_stock_count', v_req);
  if v is not null then return (v #>> '{}')::uuid; end if;
  v_id := start_stock_count__run(p_items => p_items, p_location => p_location);
  perform audit_event(v_business, 'inventory.count.start', 'stock_count', v_id::text, null, null,
    null);
  perform idem_finish(v_business, p_idempotency_key, 'start_stock_count', v_req, to_jsonb(v_id));
  return v_id;
end $$;

alter function submit_stock_count(uuid) rename to submit_stock_count__run;
revoke execute on function submit_stock_count__run(uuid) from public, anon, authenticated;
create or replace function submit_stock_count(
  p_count uuid,
  p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_count', p_count);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'submit_stock_count', v_req);
  if v is not null then return; end if;
  perform submit_stock_count__run(p_count => p_count);
  perform audit_event(v_business, 'inventory.count.submit', 'stock_count', p_count::text, null, null,
    null);
  perform idem_finish(v_business, p_idempotency_key, 'submit_stock_count', v_req, 'null'::jsonb);
end $$;

alter function unlock_period(uuid, text) rename to unlock_period__run;
revoke execute on function unlock_period__run(uuid, text) from public, anon, authenticated;
create or replace function unlock_period(
  p_period uuid,
  p_reason text,
  p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_period', p_period, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'unlock_period', v_req);
  if v is not null then return; end if;
  perform unlock_period__run(p_period => p_period, p_reason => p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'unlock_period', v_req, 'null'::jsonb);
end $$;

alter function void_sale(uuid, text, text, uuid) rename to void_sale__run;
revoke execute on function void_sale__run(uuid, text, text, uuid) from public, anon, authenticated;
create or replace function void_sale(
  p_order uuid,
  p_reason text DEFAULT NULL::text,
  p_reason_code text DEFAULT NULL::text,
  p_approval uuid DEFAULT NULL::uuid,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_order', p_order, 'p_reason', p_reason, 'p_reason_code', p_reason_code, 'p_approval', p_approval);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'void_sale', v_req);
  if v is not null then return v; end if;
  v := void_sale__run(p_order => p_order, p_reason => p_reason, p_reason_code => p_reason_code, p_approval => p_approval);
  perform idem_finish(v_business, p_idempotency_key, 'void_sale', v_req, v);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Who may call what: signed-in people call the keyed versions
-- ---------------------------------------------------------------------------
revoke execute on function add_delivery_platform(text, text, jsonb, uuid) from public, anon;
grant execute on function add_delivery_platform(text, text, jsonb, uuid) to authenticated;
revoke execute on function add_item_unit(uuid, text, text, numeric, uuid) from public, anon;
grant execute on function add_item_unit(uuid, text, text, numeric, uuid) to authenticated;
revoke execute on function adjust_stock(uuid, numeric, text, text, numeric, uuid, uuid) from public, anon;
grant execute on function adjust_stock(uuid, numeric, text, text, numeric, uuid, uuid) to authenticated;
revoke execute on function approve_stock_count(uuid, uuid) from public, anon;
grant execute on function approve_stock_count(uuid, uuid) to authenticated;
revoke execute on function cancel_bill(uuid, text, date, uuid) from public, anon;
grant execute on function cancel_bill(uuid, text, date, uuid) to authenticated;
revoke execute on function cancel_card_settlement(uuid, text, uuid) from public, anon;
grant execute on function cancel_card_settlement(uuid, text, uuid) to authenticated;
revoke execute on function cancel_platform_settlement(uuid, text, uuid) from public, anon;
grant execute on function cancel_platform_settlement(uuid, text, uuid) to authenticated;
revoke execute on function cancel_production(uuid, text, uuid) from public, anon;
grant execute on function cancel_production(uuid, text, uuid) to authenticated;
revoke execute on function cancel_scheduled_price(uuid, text, uuid) from public, anon;
grant execute on function cancel_scheduled_price(uuid, text, uuid) to authenticated;
revoke execute on function cancel_scheduled_recipe(uuid, text, uuid) from public, anon;
grant execute on function cancel_scheduled_recipe(uuid, text, uuid) to authenticated;
revoke execute on function cancel_stock_count(uuid, text, uuid) from public, anon;
grant execute on function cancel_stock_count(uuid, text, uuid) to authenticated;
revoke execute on function cancel_tab(uuid, integer, text, text, uuid) from public, anon;
grant execute on function cancel_tab(uuid, integer, text, text, uuid) to authenticated;
revoke execute on function change_product_recipe(uuid, jsonb, date, uuid) from public, anon;
grant execute on function change_product_recipe(uuid, jsonb, date, uuid) to authenticated;
revoke execute on function copy_platform_setup(text, text, boolean, uuid) from public, anon;
grant execute on function copy_platform_setup(text, text, boolean, uuid) to authenticated;
revoke execute on function count_drawer(numeric, numeric, text, numeric, uuid, uuid) from public, anon;
grant execute on function count_drawer(numeric, numeric, text, numeric, uuid, uuid) to authenticated;
revoke execute on function create_item(text, item_type, text, unit_dimension, text, text, numeric, jsonb, numeric, numeric, boolean, text, uuid) from public, anon;
grant execute on function create_item(text, item_type, text, unit_dimension, text, text, numeric, jsonb, numeric, numeric, boolean, text, uuid) to authenticated;
revoke execute on function create_product(text, jsonb, jsonb, text, text, uuid, text, uuid) from public, anon;
grant execute on function create_product(text, jsonb, jsonb, text, text, uuid, text, uuid) to authenticated;
revoke execute on function create_supplier(text, text, text, uuid) from public, anon;
grant execute on function create_supplier(text, text, text, uuid) to authenticated;
revoke execute on function discard_journal(uuid, uuid) from public, anon;
grant execute on function discard_journal(uuid, uuid) to authenticated;
revoke execute on function invite_member(text, text, app_role[], uuid) from public, anon;
grant execute on function invite_member(text, text, app_role[], uuid) to authenticated;
revoke execute on function lock_period(uuid, text, uuid) from public, anon;
grant execute on function lock_period(uuid, text, uuid) to authenticated;
revoke execute on function mark_bill_printed(uuid, integer, uuid) from public, anon;
grant execute on function mark_bill_printed(uuid, integer, uuid) to authenticated;
revoke execute on function move_cash(text, text, numeric, text, uuid, uuid) from public, anon;
grant execute on function move_cash(text, text, numeric, text, uuid, uuid) to authenticated;
revoke execute on function open_tab(sales_channel, uuid, text, uuid, jsonb, numeric, numeric, text, text, uuid, uuid) from public, anon;
grant execute on function open_tab(sales_channel, uuid, text, uuid, jsonb, numeric, numeric, text, text, uuid, uuid) to authenticated;
revoke execute on function pay_bill(uuid, numeric, text, uuid) from public, anon;
grant execute on function pay_bill(uuid, numeric, text, uuid) to authenticated;
revoke execute on function post_control_correction(date, text, jsonb, text, uuid) from public, anon;
grant execute on function post_control_correction(date, text, jsonb, text, uuid) to authenticated;
revoke execute on function post_legacy_unposted(text, uuid) from public, anon;
grant execute on function post_legacy_unposted(text, uuid) to authenticated;
revoke execute on function post_platform_settlement(text, text, jsonb, date, text, uuid) from public, anon;
grant execute on function post_platform_settlement(text, text, jsonb, date, text, uuid) to authenticated;
revoke execute on function publish_journal(uuid, uuid) from public, anon;
grant execute on function publish_journal(uuid, uuid) to authenticated;
revoke execute on function receive_goods(uuid, jsonb, numeric, numeric, numeric, text, uuid, boolean, uuid) from public, anon;
grant execute on function receive_goods(uuid, jsonb, numeric, numeric, numeric, text, uuid, boolean, uuid) to authenticated;
revoke execute on function record_bill(uuid, text, date, numeric, integer, uuid, text, uuid) from public, anon;
grant execute on function record_bill(uuid, text, date, numeric, integer, uuid, text, uuid) to authenticated;
revoke execute on function record_card_settlement(date, numeric, numeric, date, text, text, uuid) from public, anon;
grant execute on function record_card_settlement(date, numeric, numeric, date, text, text, uuid) to authenticated;
revoke execute on function record_expense(text, numeric, text, text, date, uuid) from public, anon;
grant execute on function record_expense(text, numeric, text, text, date, uuid) to authenticated;
revoke execute on function record_opening_stock(uuid, numeric, text, numeric, text, uuid, uuid) from public, anon;
grant execute on function record_opening_stock(uuid, numeric, text, numeric, text, uuid, uuid) to authenticated;
revoke execute on function record_production(uuid, numeric, numeric, text, text, uuid, uuid) from public, anon;
grant execute on function record_production(uuid, numeric, numeric, text, text, uuid, uuid) to authenticated;
revoke execute on function record_waste(uuid, numeric, text, movement_type, text, uuid, uuid) from public, anon;
grant execute on function record_waste(uuid, numeric, text, movement_type, text, uuid, uuid) to authenticated;
revoke execute on function refund_sale(uuid, text, text, uuid, uuid) from public, anon;
grant execute on function refund_sale(uuid, text, text, uuid, uuid) to authenticated;
revoke execute on function reject_stock_count(uuid, text, uuid) from public, anon;
grant execute on function reject_stock_count(uuid, text, uuid) to authenticated;
revoke execute on function reverse_journal(uuid, text, date, uuid) from public, anon;
grant execute on function reverse_journal(uuid, text, date, uuid) to authenticated;
revoke execute on function save_batch_recipe(uuid, text, jsonb, numeric, text, jsonb, text, boolean, uuid) from public, anon;
grant execute on function save_batch_recipe(uuid, text, jsonb, numeric, text, jsonb, text, boolean, uuid) to authenticated;
revoke execute on function save_category(uuid, text, text, text, integer, boolean, uuid) from public, anon;
grant execute on function save_category(uuid, text, text, text, integer, boolean, uuid) to authenticated;
revoke execute on function save_journal(date, text, jsonb, boolean, text, date, uuid) from public, anon;
grant execute on function save_journal(date, text, jsonb, boolean, text, date, uuid) to authenticated;
revoke execute on function save_tab(uuid, integer, jsonb, text, uuid, numeric, numeric, text, text, uuid, uuid) from public, anon;
grant execute on function save_tab(uuid, integer, jsonb, text, uuid, numeric, numeric, text, text, uuid, uuid) to authenticated;
revoke execute on function save_table(uuid, text, text, integer, integer, boolean, uuid, uuid) from public, anon;
grant execute on function save_table(uuid, text, text, integer, integer, boolean, uuid, uuid) to authenticated;
revoke execute on function set_price(uuid, sales_channel, numeric, date, uuid) from public, anon;
grant execute on function set_price(uuid, sales_channel, numeric, date, uuid) to authenticated;
revoke execute on function split_tab(uuid, integer, jsonb, text, uuid) from public, anon;
grant execute on function split_tab(uuid, integer, jsonb, text, uuid) to authenticated;
revoke execute on function start_stock_count(uuid[], uuid, uuid) from public, anon;
grant execute on function start_stock_count(uuid[], uuid, uuid) to authenticated;
revoke execute on function submit_stock_count(uuid, uuid) from public, anon;
grant execute on function submit_stock_count(uuid, uuid) to authenticated;
revoke execute on function unlock_period(uuid, text, uuid) from public, anon;
grant execute on function unlock_period(uuid, text, uuid) to authenticated;
revoke execute on function void_sale(uuid, text, text, uuid, uuid) from public, anon;
grant execute on function void_sale(uuid, text, text, uuid, uuid) to authenticated;
