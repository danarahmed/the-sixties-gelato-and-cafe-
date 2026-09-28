-- =============================================================================
-- 0044 — Purchasing: orders, returns to suppliers, and their credits (release S)
--
-- Nothing wrote a purchase order, a return or a supplier's credit
-- (docs/COMPLETION_PLAN.md, B7–B9, D8, D9). The owner's default (decision 10):
-- a branch manager approves an order up to 250,000 IQD, and the owner or the
-- general manager above it.
--   * Purchase orders: a draft and its lines, approved by someone whose limit
--     covers it (a rule on Settings, by role), sent to the supplier, received
--     against, delivery by delivery (more than was ordered is confirmed), then
--     closed, or cancelled while nothing has come. What has come is read from
--     the deliveries as they stand, never stored.
--   * Returns to a supplier: the stock leaves at its cost now, and the supplier
--     owes back what the delivery charged for it. Before the delivery is
--     billed, the return comes off what its bill will clear (2050); after, it
--     is a credit on the supplier's account (2000), set against the bill.
--   * Credits: the supplier's credit note for a price, or against a bill for a
--     service; the supplier's note for a return, matched to its credit. A
--     credit is set against bills; a bill's paid amount is its payments and the
--     credits set against it.
--   * The supplier's statement, dated, and Reports → Purchasing.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Purchase orders
-- ---------------------------------------------------------------------------
-- Tables since 0003 that nothing wrote: every database has them empty. The
-- status becomes the order's step (draft, approved, sent, closed, cancelled);
-- its deliveries say how much of it has come.
do $$
begin
  if exists (select 1 from purchase_order) then
    raise exception 'Purchase orders exist: 0044 expects none, as nothing wrote them before it';
  end if;
end $$;

alter table purchase_order alter column status drop default;
alter table purchase_order alter column status type text using status::text;
alter table purchase_order alter column status set default 'draft';
drop type if exists po_status;
alter table purchase_order drop column if exists expected_at;
alter table purchase_order add column if not exists po_no bigint;
alter table purchase_order add column if not exists expected_on date;
alter table purchase_order add column if not exists total numeric not null default 0;
alter table purchase_order add column if not exists approved_by uuid references app_user (id);
alter table purchase_order add column if not exists approved_at timestamptz;
alter table purchase_order add column if not exists sent_by uuid references app_user (id);
alter table purchase_order add column if not exists sent_at timestamptz;
alter table purchase_order add column if not exists closed_by uuid references app_user (id);
alter table purchase_order add column if not exists closed_at timestamptz;
alter table purchase_order add column if not exists close_reason text;
alter table purchase_order add column if not exists cancelled_by uuid references app_user (id);
alter table purchase_order add column if not exists cancelled_at timestamptz;
alter table purchase_order add column if not exists cancel_reason text;
alter table purchase_order add column if not exists updated_at timestamptz not null default now();
alter table purchase_order drop constraint if exists purchase_order_status;
alter table purchase_order add constraint purchase_order_status
  check (status in ('draft', 'approved', 'sent', 'closed', 'cancelled'));
alter table purchase_order drop constraint if exists purchase_order_steps;
alter table purchase_order add constraint purchase_order_steps check (
  po_no is not null and total >= 0
  and (status = 'draft' or approved_at is not null or cancelled_at is not null)
  and (status <> 'sent' or sent_at is not null)
  and (status <> 'closed' or closed_at is not null)
  and (status <> 'cancelled' or (cancelled_at is not null and length(trim(cancel_reason)) > 0)));
create unique index if not exists purchase_order_no on purchase_order (business_id, po_no);
create index if not exists purchase_order_supplier_idx on purchase_order (business_id, supplier_id);

-- A line: an item once per order, in a unit it is bought in, at a price per
-- that unit; its quantity in the item's base unit is kept with it.
alter table purchase_order_line add column if not exists line_no int;
alter table purchase_order_line add column if not exists base_qty numeric;
alter table purchase_order_line drop constraint if exists purchase_order_line_base;
alter table purchase_order_line add constraint purchase_order_line_base check (base_qty > 0 and line_no > 0);
create unique index if not exists purchase_order_line_item on purchase_order_line (purchase_order_id, item_id);
create index if not exists purchase_order_line_order on purchase_order_line (purchase_order_id);

-- A delivery against an order, line by line.
alter table goods_receipt_line add column if not exists purchase_order_line_id uuid
  references purchase_order_line (id);
create index if not exists goods_receipt_po on goods_receipt (purchase_order_id) where purchase_order_id is not null;

-- An order's lines change only while it is a draft.
create or replace function trg_po_line_draft() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from purchase_order
   where id = case when TG_OP = 'DELETE' then OLD.purchase_order_id else NEW.purchase_order_id end;
  if v_status is distinct from 'draft' then
    raise exception 'An order''s lines change only while it is a draft' using errcode = 'check_violation';
  end if;
  return case when TG_OP = 'DELETE' then OLD else NEW end;
end $$;
drop trigger if exists purchase_order_line_draft on purchase_order_line;
create trigger purchase_order_line_draft before insert or update or delete on purchase_order_line
  for each row execute function trg_po_line_draft();

-- Who approves an order: the owner and the managers, each up to their limit.
insert into role_permission (role, permission)
select r::app_role, p from (values
  ('owner','purchase.approve'),('general_manager','purchase.approve'),('branch_manager','purchase.approve')
) as v(r, p)
on conflict do nothing;

-- The rules, with the orders' limit (decision 10).
create or replace function rule_definitions() returns jsonb
language sql immutable set search_path = public as $$
  select '{
    "discount_cap_percent":  {"kind": "percent", "min": 0, "max": 100, "whole": false,
                              "scopes": ["business", "role"],
                              "label": "Discounts a manager approves, over (% of the bill)"},
    "discount_round_to":     {"kind": "amount", "min": 1, "max": 100000, "whole": true,
                              "scopes": ["business"],
                              "label": "A discount given as a percentage is rounded to"},
    "refund_approval_over":  {"kind": "amount", "min": 0, "max": 100000000, "whole": true,
                              "scopes": ["business", "role"],
                              "label": "Refunds a second person approves, over"},
    "waste_approval_over":   {"kind": "amount", "min": 0, "max": 100000000, "whole": true,
                              "scopes": ["business", "role"],
                              "label": "Losses a manager approves, over"},
    "waste_approval_window": {"kind": "choice", "choices": ["entry", "session", "day"],
                              "scopes": ["business"],
                              "label": "One person''s losses are added up over"},
    "negative_stock":        {"kind": "choice", "choices": ["block", "approve", "alert", "allow"],
                              "scopes": ["business", "item_type", "item"],
                              "label": "Using more stock than the books hold"},
    "usd_rate_max_age_hours": {"kind": "hours", "min": 1, "max": 168, "whole": true,
                              "scopes": ["business"],
                              "label": "Dollars are taken at a rate set within the last"},
    "usd_round_to":          {"kind": "amount", "min": 1, "max": 100000, "whole": true,
                              "scopes": ["business"],
                              "label": "Dollars are counted in dinars to the nearest"},
    "po_approve_up_to":      {"kind": "amount", "min": 0, "max": 1000000000, "whole": true,
                              "scopes": ["business", "role"],
                              "label": "Purchase orders a manager approves, up to"}
  }'::jsonb
$$;

create or replace function rule_defaults(p_business uuid)
returns table (key text, scope_type text, scope_id text, value jsonb)
language sql stable set search_path = public as $$
  select 'discount_cap_percent', 'business', '', to_jsonb(b.discount_cap_percent) from business b where b.id = p_business
  union all
  select 'discount_round_to', 'business', '', to_jsonb(b.discount_round_to) from business b where b.id = p_business
  union all
  select 'refund_approval_over', 'business', '', to_jsonb(25000)
  union all
  select 'waste_approval_over', 'business', '', to_jsonb(b.waste_approval_threshold) from business b where b.id = p_business
  union all
  select 'waste_approval_window', 'business', '', to_jsonb('session'::text)
  union all
  select 'negative_stock', 'business', '',
         to_jsonb(case when b.prevent_negative_stock then 'block' else 'alert' end) from business b where b.id = p_business
  union all
  select 'negative_stock', 'item_type', t, to_jsonb('block'::text) from unnest(array['finished_good', 'sub_recipe_output']) t
  union all
  select 'usd_rate_max_age_hours', 'business', '', to_jsonb(36)
  union all
  select 'usd_round_to', 'business', '', to_jsonb(250)
  union all
  select 'po_approve_up_to', 'business', '', to_jsonb(250000)
  union all
  select 'po_approve_up_to', 'role', r, to_jsonb(1000000000) from unnest(array['owner', 'general_manager']) r
$$;

-- What has come against an order, item by item, from its deliveries as they
-- stand now (a delivery corrected counts as corrected; one reversed, not at all).
create or replace function po_received(p_po uuid) returns table (item_id uuid, base_qty numeric, value numeric)
language sql stable set search_path = public as $$
  select (l ->> 'item_id')::uuid, sum((l ->> 'base_qty')::numeric), sum((l ->> 'landed')::numeric)
    from goods_receipt r cross join lateral jsonb_array_elements(receipt_state(r.id) -> 'lines') l
   where r.purchase_order_id = p_po
   group by 1
$$;

-- An order as the screens show it: its lines, what has come of each, its
-- deliveries, and how far it has come (none, part, all).
create or replace function po_view(p_po uuid) returns jsonb
language sql stable set search_path = public as $$
  with po as (select * from purchase_order where id = p_po),
  lines as (
    select l.*, i.name as item_name, i.base_unit_code, coalesce(g.base_qty, 0) as received_base,
           greatest(l.base_qty - coalesce(g.base_qty, 0), 0) as outstanding_base
      from purchase_order_line l join item i on i.id = l.item_id
      left join po_received(p_po) g on g.item_id = l.item_id
     where l.purchase_order_id = p_po
  )
  select jsonb_build_object(
    'id', po.id, 'po_no', po.po_no, 'status', po.status,
    'receiving', case when not exists (select 1 from goods_receipt r where r.purchase_order_id = p_po) then 'none'
                      when exists (select 1 from lines where outstanding_base > 0) then 'part'
                      else 'all' end,
    'supplier_id', po.supplier_id, 'supplier', (select name from supplier where id = po.supplier_id),
    'location_id', po.location_id, 'location', (select name from location where id = po.location_id),
    'expected_on', po.expected_on, 'note', po.note, 'total', po.total,
    'created_at', po.ordered_at, 'created_by', (select full_name from app_user where id = po.created_by),
    'approved_at', po.approved_at, 'approved_by', (select full_name from app_user where id = po.approved_by),
    'sent_at', po.sent_at, 'sent_by', (select full_name from app_user where id = po.sent_by),
    'closed_at', po.closed_at, 'closed_by', (select full_name from app_user where id = po.closed_by),
    'close_reason', po.close_reason,
    'cancelled_at', po.cancelled_at, 'cancelled_by', (select full_name from app_user where id = po.cancelled_by),
    'cancel_reason', po.cancel_reason,
    'lines', coalesce((select jsonb_agg(jsonb_build_object(
                'line_id', l.id, 'line_no', l.line_no, 'item_id', l.item_id, 'item', l.item_name,
                'qty', l.order_qty, 'unit_code', l.order_unit_code, 'unit_price', l.unit_price,
                'amount', money_round(po.business_id, l.order_qty * l.unit_price),
                'base_qty', l.base_qty, 'base_unit', l.base_unit_code,
                'received_base', l.received_base, 'outstanding_base', l.outstanding_base)
              order by l.line_no) from lines l), '[]'::jsonb),
    'unexpected', coalesce((select jsonb_agg(jsonb_build_object('item_id', g.item_id, 'item', i.name,
                                                                'base_qty', g.base_qty, 'base_unit', i.base_unit_code)
                                             order by i.name)
                              from po_received(p_po) g join item i on i.id = g.item_id
                             where not exists (select 1 from lines l where l.item_id = g.item_id)
                               and g.base_qty <> 0), '[]'::jsonb),
    'deliveries', coalesce((select jsonb_agg(jsonb_build_object('receipt_id', r.id, 'receipt_no', r.receipt_no,
                                                                'received_at', r.received_at)
                                             order by r.received_at, r.receipt_no)
                              from goods_receipt r where r.purchase_order_id = p_po), '[]'::jsonb))
  from po
$$;

-- (cost.view) The orders: those still open, and the last 100 closed or
-- cancelled, newest first, each as po_view gives it, with whether the reader
-- may approve it.
create or replace function purchase_orders() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cost.view');
  v_me uuid := (current_member()).id;
  v_limit numeric := case when current_has_permission('purchase.approve')
                          then member_rule_number(v_business, 'po_approve_up_to', v_me) end;
begin
  return jsonb_build_object(
    'approve_up_to', v_limit,
    'orders', coalesce((select jsonb_agg(po_view(o.id) || jsonb_build_object(
                          'may_approve', o.status = 'draft' and v_limit is not null and o.total <= v_limit)
                        order by o.status in ('closed', 'cancelled'), o.po_no desc)
                          from (select * from purchase_order
                                 where business_id = v_business and status not in ('closed', 'cancelled')
                                union all
                                (select * from purchase_order
                                  where business_id = v_business and status in ('closed', 'cancelled')
                                  order by po_no desc limit 100)) o), '[]'::jsonb));
end $$;

-- (cost.view) One order, as po_view gives it: its page, printed for the supplier.
create or replace function purchase_order(p_po uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cost.view');
  v_limit numeric := case when current_has_permission('purchase.approve')
                          then member_rule_number(v_business, 'po_approve_up_to', (current_member()).id) end;
  o purchase_order;
begin
  select * into o from purchase_order where id = p_po and business_id = v_business;
  if not found then raise exception 'Order not found'; end if;
  return po_view(o.id) || jsonb_build_object('may_approve', o.status = 'draft' and v_limit is not null
                                                            and o.total <= v_limit);
end $$;

-- An order's lines, checked: items in use, once each, in a unit they are
-- bought in, a quantity and a price. Returns them with their base quantity.
create or replace function po_lines_checked(p_business uuid, p_lines jsonb) returns jsonb
language plpgsql stable set search_path = public as $$
declare l jsonb; it item; v_out jsonb := '[]'; v_qty numeric; v_price numeric; v_base numeric; v_unit text;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one line';
  end if;
  if jsonb_array_length(p_lines) > 100 then raise exception 'An order has at most 100 lines'; end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    select * into it from item where id = (l ->> 'item_id')::uuid and business_id = p_business;
    if not found then raise exception 'Unknown item on the order'; end if;
    if not it.is_active then raise exception '% is out of use: bring it back into use first', it.name; end if;
    if exists (select 1 from jsonb_array_elements(v_out) x where (x ->> 'item_id')::uuid = it.id) then
      raise exception '% is on the order twice: one line for it', it.name;
    end if;
    v_qty := (l ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Every line needs a quantity'; end if;
    v_price := (l ->> 'unit_price')::numeric;
    if v_price is null or v_price < 0 then raise exception 'Every line needs a price'; end if;
    v_unit := coalesce(nullif(l ->> 'unit_code', ''), it.base_unit_code);
    v_base := to_base_qty(it.id, v_qty, v_unit);
    if v_base is null or v_base <= 0 then raise exception '% is not bought in %', it.name, v_unit; end if;
    v_out := v_out || jsonb_build_object('item_id', it.id, 'qty', v_qty, 'unit_code', v_unit,
                                         'unit_price', v_price, 'base_qty', v_base);
  end loop;
  return v_out;
end $$;

-- An order as the audit trail keeps it, before a change and after it: the
-- same keys both times, so the trail shows only what changed.
create or replace function po_snapshot(p_po uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'po_no', o.po_no, 'supplier', o.supplier_id, 'location', o.location_id, 'status', o.status,
    'total', o.total, 'expected_on', o.expected_on, 'note', o.note,
    'order_lines', coalesce((select jsonb_agg(jsonb_build_object('item_id', l.item_id, 'qty', l.order_qty,
                                                                 'unit_code', l.order_unit_code,
                                                                 'unit_price', l.unit_price)
                                              order by l.line_no)
                               from purchase_order_line l where l.purchase_order_id = o.id), '[]'::jsonb))
    from purchase_order o where o.id = p_po
$$;

-- A new order (p_po null), or a draft changed. An approved order changed goes
-- back to being a draft, to be approved again; one sent is not changed.
create or replace function save_po__run(p_po uuid, p_supplier uuid, p_lines jsonb, p_expected_on date,
                                        p_note text, p_location uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create');
  v_me uuid := (current_member()).id;
  o purchase_order; v_lines jsonb; v_total numeric; v_location uuid; v_new boolean := p_po is null;
  v_was text; v_before jsonb; l jsonb; i int := 0;
begin
  if not exists (select 1 from supplier where id = p_supplier and business_id = v_business and is_active) then
    raise exception 'Choose an active supplier';
  end if;
  v_lines := po_lines_checked(v_business, p_lines);
  v_location := resolve_location(v_business, p_location);
  select coalesce(sum(money_round(v_business, (x ->> 'qty')::numeric * (x ->> 'unit_price')::numeric)), 0)
    into v_total from jsonb_array_elements(v_lines) x;
  if v_new then
    insert into purchase_order (business_id, supplier_id, location_id, status, expected_on, note, created_by,
                                po_no, total)
    values (v_business, p_supplier, v_location, 'draft', p_expected_on, nullif(trim(p_note), ''), v_me,
            next_document_no(v_business, 'purchase_order', 1), v_total)
    returning * into o;
  else
    select * into o from purchase_order where id = p_po and business_id = v_business for update;
    if not found then raise exception 'Order not found'; end if;
    v_was := o.status;
    if o.status not in ('draft', 'approved') then
      raise exception 'Order % has been sent: cancel it and make a new one, or close it', o.po_no;
    end if;
    v_before := po_snapshot(o.id);
    update purchase_order
       set status = 'draft', supplier_id = p_supplier, location_id = v_location, expected_on = p_expected_on,
           note = nullif(trim(p_note), ''), total = v_total, approved_by = null, approved_at = null,
           updated_at = now()
     where id = o.id
    returning * into o;
    delete from purchase_order_line where purchase_order_id = o.id;
  end if;
  for l in select * from jsonb_array_elements(v_lines) loop
    i := i + 1;
    insert into purchase_order_line (purchase_order_id, item_id, order_qty, order_unit_code, unit_price, line_no,
                                     base_qty)
    values (o.id, (l ->> 'item_id')::uuid, (l ->> 'qty')::numeric, l ->> 'unit_code', (l ->> 'unit_price')::numeric,
            i, (l ->> 'base_qty')::numeric);
  end loop;
  perform audit_event(v_business, case when v_new then 'purchase.order.create' else 'purchase.order.change' end,
    'purchase_order', o.id::text, null, v_before, po_snapshot(o.id));
  return jsonb_build_object('po_id', o.id, 'po_no', o.po_no, 'status', o.status, 'total', v_total,
                            'was', v_was);
end $$;

create or replace function save_po(p_po uuid, p_supplier uuid, p_lines jsonb, p_expected_on date default null,
                                   p_note text default null, p_location uuid default null,
                                   p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_po', p_po, 'p_supplier', p_supplier, 'p_lines', p_lines,
                                    'p_expected_on', p_expected_on, 'p_note', p_note, 'p_location', p_location);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'save_po', v_req);
  if v is not null then return v; end if;
  v := save_po__run(p_po => p_po, p_supplier => p_supplier, p_lines => p_lines, p_expected_on => p_expected_on,
                    p_note => p_note, p_location => p_location);
  perform idem_finish(v_business, p_idempotency_key, 'save_po', v_req, v);
  return v;
end $$;

-- Approving a draft: someone who approves orders, whose limit covers it.
create or replace function approve_po__run(p_po uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.approve');
  v_me uuid := (current_member()).id;
  o purchase_order; v_limit numeric;
begin
  select * into o from purchase_order where id = p_po and business_id = v_business for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status <> 'draft' then raise exception 'Order % is not a draft waiting to be approved', o.po_no; end if;
  if o.total <= 0 then raise exception 'Order % comes to nothing: give its lines their prices', o.po_no; end if;
  v_limit := member_rule_number(v_business, 'po_approve_up_to', v_me);
  if o.total > coalesce(v_limit, 0) then
    raise exception 'You approve orders up to %; order % comes to %: someone whose limit covers it approves it',
      trim_scale(coalesce(v_limit, 0)), o.po_no, trim_scale(o.total);
  end if;
  update purchase_order set status = 'approved', approved_by = v_me, approved_at = now(), updated_at = now()
   where id = o.id;
  perform audit_event(v_business, 'purchase.order.approve', 'purchase_order', o.id::text, null, null,
    jsonb_build_object('po_no', o.po_no, 'total', o.total, 'limit', v_limit));
  return jsonb_build_object('po_id', o.id, 'po_no', o.po_no, 'status', 'approved', 'total', o.total);
end $$;

create or replace function approve_po(p_po uuid, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_po', p_po);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'approve_po', v_req);
  if v is not null then return v; end if;
  v := approve_po__run(p_po => p_po);
  perform idem_finish(v_business, p_idempotency_key, 'approve_po', v_req, v);
  return v;
end $$;

-- Sent: the supplier has it (printed, or sent as it is on the screen).
create or replace function send_po__run(p_po uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'purchase.approve');
  v_me uuid := (current_member()).id;
  o purchase_order;
begin
  select * into o from purchase_order where id = p_po and business_id = v_business for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status = 'draft' then raise exception 'Order % is not approved yet', o.po_no; end if;
  if o.status <> 'approved' then raise exception 'Order % is not waiting to be sent', o.po_no; end if;
  update purchase_order set status = 'sent', sent_by = v_me, sent_at = now(), updated_at = now() where id = o.id;
  perform audit_event(v_business, 'purchase.order.send', 'purchase_order', o.id::text, null, null,
    jsonb_build_object('po_no', o.po_no, 'total', o.total));
  return jsonb_build_object('po_id', o.id, 'po_no', o.po_no, 'status', 'sent');
end $$;

create or replace function send_po(p_po uuid, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_po', p_po);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'send_po', v_req);
  if v is not null then return v; end if;
  v := send_po__run(p_po => p_po);
  perform idem_finish(v_business, p_idempotency_key, 'send_po', v_req, v);
  return v;
end $$;

-- Closed: nothing more is expected against it. Short of what was ordered, say why.
create or replace function close_po__run(p_po uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'purchase.approve');
  v_me uuid := (current_member()).id;
  o purchase_order; v jsonb; v_reason text := nullif(trim(p_reason), '');
begin
  select * into o from purchase_order where id = p_po and business_id = v_business for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status not in ('approved', 'sent') then raise exception 'Order % is not open', o.po_no; end if;
  v := po_view(o.id);
  if v ->> 'receiving' = 'none' then
    raise exception 'Nothing has come against order %: cancel it instead', o.po_no;
  end if;
  if v ->> 'receiving' = 'part' and v_reason is null then
    raise exception 'Order % has not all come: say why the rest is not coming', o.po_no;
  end if;
  update purchase_order set status = 'closed', closed_by = v_me, closed_at = now(), close_reason = v_reason,
                            updated_at = now()
   where id = o.id;
  perform audit_event(v_business, 'purchase.order.close', 'purchase_order', o.id::text, v_reason, null,
    jsonb_build_object('po_no', o.po_no, 'short', v ->> 'receiving' = 'part'));
  return jsonb_build_object('po_id', o.id, 'po_no', o.po_no, 'status', 'closed', 'receiving', v ->> 'receiving');
end $$;

create or replace function close_po(p_po uuid, p_reason text default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_po', p_po, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'close_po', v_req);
  if v is not null then return v; end if;
  v := close_po__run(p_po => p_po, p_reason => p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'close_po', v_req, v);
  return v;
end $$;

-- Cancelled: while nothing has come against it, and with a reason.
create or replace function cancel_po__run(p_po uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'purchase.approve');
  v_me uuid := (current_member()).id;
  o purchase_order; v_reason text := nullif(trim(p_reason), '');
begin
  if v_reason is null then raise exception 'Say why the order is being cancelled'; end if;
  select * into o from purchase_order where id = p_po and business_id = v_business for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status in ('closed', 'cancelled') then raise exception 'Order % is not open', o.po_no; end if;
  if exists (select 1 from goods_receipt where purchase_order_id = o.id) then
    raise exception 'Goods have come against order %: close it instead', o.po_no;
  end if;
  update purchase_order set status = 'cancelled', cancelled_by = v_me, cancelled_at = now(),
                            cancel_reason = v_reason, updated_at = now()
   where id = o.id;
  perform audit_event(v_business, 'purchase.order.cancel', 'purchase_order', o.id::text, v_reason,
    jsonb_build_object('status', o.status), jsonb_build_object('po_no', o.po_no, 'total', o.total));
  return jsonb_build_object('po_id', o.id, 'po_no', o.po_no, 'status', 'cancelled');
end $$;

create or replace function cancel_po(p_po uuid, p_reason text, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_po', p_po, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'cancel_po', v_req);
  if v is not null then return v; end if;
  v := cancel_po__run(p_po => p_po, p_reason => p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'cancel_po', v_req, v);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Receiving against an order
-- ---------------------------------------------------------------------------
-- 0027's receive_goods (its work, since 0035), against an order when one is
-- named (p_purchase_order): approved or sent, from its supplier, into its
-- branch. A line is its order line's (po_line_id, or the order's line for its
-- item); an item not on the order comes as it is. More than is still on order
-- is asked about, as a price far from the cost now is, and confirmed.
drop function if exists receive_goods(uuid, jsonb, numeric, numeric, numeric, text, uuid, boolean, uuid);
drop function if exists receive_goods__run(uuid, jsonb, numeric, numeric, numeric, text, uuid, boolean);
create or replace function receive_goods__run(
  p_supplier uuid, p_lines jsonb, p_freight numeric default 0, p_other numeric default 0,
  p_rebate numeric default 0, p_note text default null, p_location uuid default null,
  p_confirm boolean default false, p_purchase_order uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.receive');
  v_me uuid := (current_member()).id;
  v_location uuid; v_receipt uuid; v_no bigint;
  v_goods numeric[] := '{}'; v_landed numeric[]; v_items uuid[] := '{}'; v_po_lines uuid[] := '{}';
  l jsonb; i int := 0; v_item uuid; v_base numeric; v_mv uuid; v_total numeric := 0; v_journal uuid;
  v_value numeric; v_cost numeric; v_ref numeric; v_warn text[] := '{}'; v_more text[] := '{}'; v_per text; it item;
  o purchase_order; pl purchase_order_line; v_line uuid; v_came numeric; v_now jsonb := '{}';
begin
  if not exists (select 1 from supplier where id = p_supplier and business_id = v_business and is_active) then
    raise exception 'Choose an active supplier';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one line'; end if;
  if coalesce(p_freight, 0) < 0 or coalesce(p_other, 0) < 0 or coalesce(p_rebate, 0) < 0 then
    raise exception 'Freight, other costs and rebates cannot be negative';
  end if;
  if p_purchase_order is not null then
    select * into o from purchase_order where id = p_purchase_order and business_id = v_business for update;
    if not found then raise exception 'Order not found'; end if;
    if o.status = 'draft' then
      raise exception 'Order % is not approved yet: approve it, or receive without it', o.po_no;
    end if;
    if o.status = 'closed' then raise exception 'Order % is closed: receive without it', o.po_no; end if;
    if o.status = 'cancelled' then raise exception 'Order % was cancelled: receive without it', o.po_no; end if;
    if o.supplier_id <> p_supplier then
      raise exception 'Order % is from %: receive it from them', o.po_no,
        (select name from supplier where id = o.supplier_id);
    end if;
    if p_location is not null and p_location <> o.location_id then
      raise exception 'Order % is for %: receive it there', o.po_no, (select name from location where id = o.location_id);
    end if;
    v_location := o.location_id;
  else
    v_location := resolve_location(v_business, p_location);
  end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    v_item := (l ->> 'item_id')::uuid;
    select * into it from item where id = v_item and business_id = v_business;
    if not found then raise exception 'Unknown item on the receipt'; end if;
    if not it.is_active then raise exception '% is out of use: bring it back into use first', it.name; end if;
    if coalesce((l ->> 'qty')::numeric, 0) <= 0 then raise exception 'Every received line needs a quantity'; end if;
    -- A price per unit (of the unit received), or the line's total.
    v_value := case when nullif(l ->> 'unit_price', '') is not null
                    then (l ->> 'unit_price')::numeric * (l ->> 'qty')::numeric
                    else (l ->> 'goods_value')::numeric end;
    if coalesce(v_value, -1) < 0 then raise exception 'Every received line needs a price'; end if;
    v_goods := v_goods || money_round(v_business, v_value);
    v_items := v_items || v_item;
    -- Its cost per base unit, against what the item costs now.
    v_base := to_base_qty(v_item, (l ->> 'qty')::numeric, l ->> 'unit_code');
    v_cost := v_value / v_base;
    v_ref := item_reference_cost(v_business, v_item, v_location);
    v_per := case when it.base_unit_code = 'each' then ' each' else ' a ' || it.base_unit_code end;
    if v_ref > 0 and abs(v_cost - v_ref) > 0.25 * v_ref then
      v_warn := v_warn || format('%s at %s%s is %s%% %s its cost now (%s%s)', it.name,
        trim_scale(round(v_cost, 4)), v_per, round(abs(v_cost - v_ref) / v_ref * 100),
        case when v_cost > v_ref then 'above' else 'below' end, trim_scale(round(v_ref, 4)), v_per);
    end if;
    -- Its line on the order, and more of it than is still on order.
    v_line := null;
    if o.id is not null then
      if nullif(l ->> 'po_line_id', '') is not null then
        select * into pl from purchase_order_line
         where id = (l ->> 'po_line_id')::uuid and purchase_order_id = o.id;
        if not found or pl.item_id <> v_item then raise exception 'That line is not on order %', o.po_no; end if;
        v_line := pl.id;
      else
        select * into pl from purchase_order_line where purchase_order_id = o.id and item_id = v_item;
        if found then v_line := pl.id; end if;
      end if;
      if v_line is not null then
        v_came := coalesce((select g.base_qty from po_received(o.id) g where g.item_id = v_item), 0)
                  + coalesce((v_now ->> v_item::text)::numeric, 0) + v_base;
        if v_came > pl.base_qty then
          v_more := v_more || format('%s: %s %s ordered, %s with this delivery', it.name,
            trim_scale(round(pl.base_qty, 3)), it.base_unit_code, trim_scale(round(v_came, 3)));
        end if;
      end if;
      v_now := v_now || jsonb_build_object(v_item::text, coalesce((v_now ->> v_item::text)::numeric, 0) + v_base);
    end if;
    v_po_lines := v_po_lines || v_line;
  end loop;
  if not coalesce(p_confirm, false) then
    if cardinality(v_warn) > 0 and cardinality(v_more) > 0 then
      raise exception 'Check the price and the quantity: %. If it is right, confirm it and receive again',
        array_to_string(v_warn || v_more, '; ');
    elsif cardinality(v_warn) > 0 then
      raise exception 'Check the price: %. If it is right, confirm it and receive again', array_to_string(v_warn, '; ');
    elsif cardinality(v_more) > 0 then
      raise exception 'Check the quantity: %. If it is right, confirm it and receive again',
        array_to_string(v_more, '; ');
    end if;
  end if;
  perform lock_items(v_items);
  v_landed := allocate_landed(v_business, v_goods, coalesce(p_freight, 0) + coalesce(p_other, 0) - coalesce(p_rebate, 0));

  v_no := next_document_no(v_business, 'receipt', 1);
  insert into goods_receipt (business_id, location_id, supplier_id, receipt_no, freight_total,
                             other_landed_total, rebate_total, received_by, note, purchase_order_id)
  values (v_business, v_location, p_supplier, v_no, coalesce(p_freight, 0), coalesce(p_other, 0),
          coalesce(p_rebate, 0), v_me, nullif(trim(p_note), ''), o.id)
  returning id into v_receipt;

  for l in select * from jsonb_array_elements(p_lines) loop
    i := i + 1;
    v_item := (l ->> 'item_id')::uuid;
    v_base := to_base_qty(v_item, (l ->> 'qty')::numeric, l ->> 'unit_code');
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                    unit_cost, value, reference_type, reference_id, app_user_id, reason)
    values (v_business, v_item, v_location, 'purchase_receipt', v_base, v_landed[i] / v_base, v_landed[i],
            'goods_receipt', v_receipt, v_me, 'Goods received')
    returning id into v_mv;
    insert into goods_receipt_line (goods_receipt_id, item_id, received_qty, received_unit_code, goods_value, movement_id,
                                    purchase_order_line_id)
    values (v_receipt, v_item, (l ->> 'qty')::numeric,
            coalesce(l ->> 'unit_code', (select base_unit_code from item where id = v_item)), v_goods[i], v_mv,
            v_po_lines[i]);
    v_total := v_total + v_landed[i];
  end loop;

  v_journal := post_journal(v_business, now(), 'Goods received — receipt ' || v_no, 'goods_receipt', v_receipt,
    jsonb_build_array(jsonb_build_object('code', '1200', 'debit', v_total),
                      jsonb_build_object('code', '2050', 'credit', v_total)));
  if cardinality(v_warn) > 0 then
    perform audit_event(v_business, 'purchase.price_confirmed', 'goods_receipt', v_receipt::text,
                        array_to_string(v_warn, '; '), null, jsonb_build_object('receipt_no', v_no));
  end if;
  if cardinality(v_more) > 0 then
    perform audit_event(v_business, 'purchase.quantity_confirmed', 'goods_receipt', v_receipt::text,
                        array_to_string(v_more, '; '), null, jsonb_build_object('receipt_no', v_no, 'po_no', o.po_no));
  end if;
  return jsonb_build_object('receipt_id', v_receipt, 'receipt_no', v_no, 'value', v_total,
    'journal_no', (select journal_no from journal_entry where id = v_journal))
    || case when o.id is not null
            then jsonb_build_object('po_id', o.id, 'po_no', o.po_no, 'po_receiving', po_view(o.id) ->> 'receiving')
            else '{}'::jsonb end;
end $$;

create or replace function receive_goods(
  p_supplier uuid,
  p_lines jsonb,
  p_freight numeric default 0,
  p_other numeric default 0,
  p_rebate numeric default 0,
  p_note text default null,
  p_location uuid default null,
  p_confirm boolean default false,
  p_purchase_order uuid default null,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_supplier', p_supplier, 'p_lines', p_lines, 'p_freight', p_freight, 'p_other', p_other, 'p_rebate', p_rebate, 'p_note', p_note, 'p_location', p_location, 'p_confirm', p_confirm)
                 || jsonb_strip_nulls(jsonb_build_object('p_purchase_order', p_purchase_order));
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'receive_goods', v_req);
  if v is not null then return v; end if;
  v := receive_goods__run(p_supplier => p_supplier, p_lines => p_lines, p_freight => p_freight, p_other => p_other, p_rebate => p_rebate, p_note => p_note, p_location => p_location, p_confirm => p_confirm, p_purchase_order => p_purchase_order);
  perform audit_event(v_business, 'purchase.receive', 'goods_receipt', v->>'receipt_id', null, null,
    jsonb_build_object('receipt_no', v->'receipt_no', 'supplier', p_supplier, 'items', p_lines, 'value', v->'value')
    || jsonb_strip_nulls(jsonb_build_object('po_no', v -> 'po_no')));
  perform idem_finish(v_business, p_idempotency_key, 'receive_goods', v_req, v);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Returns to a supplier
-- ---------------------------------------------------------------------------
-- Goods sent back: the stock leaves at its cost now (the last of an item with
-- what is left of its value), and the supplier owes back what they charged
-- for it: its share of the delivery it came in, or, with no delivery named,
-- its cost now. The difference is a price variance (5050). Against a delivery
-- not yet billed, the return comes off what its bill will clear (2050);
-- otherwise it is owed back on the supplier's account (2000), as a credit
-- set against the delivery's bill as far as the bill is still owed.
create table if not exists supplier_return (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references business (id) on delete cascade,
  return_no        bigint not null,
  supplier_id      uuid not null references supplier (id),
  goods_receipt_id uuid references goods_receipt (id),
  location_id      uuid not null references location (id),
  reason           text not null check (length(trim(reason)) > 0),
  value            numeric not null check (value >= 0),
  stock_value      numeric not null check (stock_value >= 0),
  against          text not null check (against in ('delivery', 'account')),
  journal_entry_id uuid references journal_entry (id),
  created_by       uuid references app_user (id),
  created_at       timestamptz not null default now(),
  constraint supplier_return_against check (against = 'account' or goods_receipt_id is not null)
);
create unique index if not exists supplier_return_no on supplier_return (business_id, return_no);
create index if not exists supplier_return_receipt on supplier_return (goods_receipt_id) where goods_receipt_id is not null;
create index if not exists supplier_return_supplier on supplier_return (business_id, supplier_id);

create table if not exists supplier_return_line (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references business (id) on delete cascade,
  supplier_return_id uuid not null references supplier_return (id),
  item_id            uuid not null references item (id),
  qty                numeric not null check (qty > 0),
  unit_code          text not null,
  base_qty           numeric not null check (base_qty > 0),
  value              numeric not null check (value >= 0),
  stock_value        numeric not null check (stock_value >= 0),
  movement_id        uuid references inventory_movement (id)
);
create index if not exists supplier_return_line_return on supplier_return_line (supplier_return_id);

do $$
declare t text;
begin
  foreach t in array array['supplier_return', 'supplier_return_line'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists cost_read on %I', t);
    execute format('create policy cost_read on %I for select to authenticated using (business_id = (select current_business_id()) and (select current_has_permission(''cost.view'')))', t);
    execute format('grant select on %I to authenticated', t);
    execute format('drop trigger if exists %I on %I', t || '_append_only', t);
    execute format('create trigger %I before update or delete on %I for each row execute function forbid_mutation()',
                   t || '_append_only', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. A supplier's credits, and what they are set against
-- ---------------------------------------------------------------------------
-- A credit on the supplier's account: for goods returned after the bill (made
-- by the return, and matched when the supplier's note comes), for a price
-- (the supplier's credit note against a delivery billed), or other (against
-- an account, a bill for a service say). Each is set against bills; what is
-- left of it is owed back, for a later bill.
create table if not exists supplier_credit (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references business (id) on delete cascade,
  credit_no           bigint not null,
  supplier_id         uuid not null references supplier (id),
  kind                text not null check (kind in ('goods_return', 'price', 'other')),
  amount              numeric not null check (amount > 0),
  credit_date         date not null,
  supplier_ref        text,
  reason              text not null check (length(trim(reason)) > 0),
  goods_receipt_id    uuid references goods_receipt (id),
  purchase_invoice_id uuid references purchase_invoice (id),
  supplier_return_id  uuid references supplier_return (id),
  account_code        text,
  journal_entry_id    uuid references journal_entry (id),
  matched_at          timestamptz,
  matched_by          uuid references app_user (id),
  created_by          uuid references app_user (id),
  created_at          timestamptz not null default now(),
  constraint supplier_credit_links check (
    (kind = 'goods_return' and supplier_return_id is not null)
    or (kind = 'price' and goods_receipt_id is not null and supplier_ref is not null)
    or (kind = 'other' and account_code is not null and supplier_ref is not null)),
  constraint supplier_credit_matched check ((supplier_ref is null) = (matched_at is null))
);
create unique index if not exists supplier_credit_no on supplier_credit (business_id, credit_no);
create unique index if not exists supplier_credit_ref
  on supplier_credit (business_id, supplier_id, lower(supplier_ref)) where supplier_ref is not null;
create index if not exists supplier_credit_supplier on supplier_credit (business_id, supplier_id);
create unique index if not exists supplier_credit_return on supplier_credit (supplier_return_id)
  where supplier_return_id is not null;

create table if not exists supplier_credit_allocation (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references business (id) on delete cascade,
  supplier_credit_id  uuid not null references supplier_credit (id),
  purchase_invoice_id uuid not null references purchase_invoice (id),
  amount              numeric not null check (amount > 0),
  created_by          uuid references app_user (id),
  created_at          timestamptz not null default now()
);
create index if not exists supplier_credit_allocation_credit on supplier_credit_allocation (supplier_credit_id);
create index if not exists supplier_credit_allocation_bill on supplier_credit_allocation (purchase_invoice_id);

do $$
declare t text;
begin
  foreach t in array array['supplier_credit', 'supplier_credit_allocation'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists cost_read on %I', t);
    execute format('create policy cost_read on %I for select to authenticated using (business_id = (select current_business_id()) and (select current_has_permission(''cost.view'')))', t);
    execute format('grant select on %I to authenticated', t);
  end loop;
end $$;
drop trigger if exists supplier_credit_allocation_append_only on supplier_credit_allocation;
create trigger supplier_credit_allocation_append_only before update or delete on supplier_credit_allocation
  for each row execute function forbid_mutation();

-- A credit never changes, but for the supplier's note matched to a return's
-- credit: its number, once.
create or replace function trg_supplier_credit_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'A supplier''s credit is never deleted' using errcode = 'check_violation';
  end if;
  if OLD.supplier_ref is not null
     or (to_jsonb(NEW) - 'supplier_ref' - 'matched_at' - 'matched_by')
        is distinct from (to_jsonb(OLD) - 'supplier_ref' - 'matched_at' - 'matched_by') then
    raise exception 'A supplier''s credit does not change' using errcode = 'check_violation';
  end if;
  return NEW;
end $$;
drop trigger if exists supplier_credit_guard on supplier_credit;
create trigger supplier_credit_guard before update or delete on supplier_credit
  for each row execute function trg_supplier_credit_guard();

-- What is set against a credit never comes to more than the credit; and each
-- setting re-totals its bill (its paid amount is its payments and credits).
create or replace function trg_supplier_credit_allocation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select coalesce(sum(amount), 0) from supplier_credit_allocation where supplier_credit_id = NEW.supplier_credit_id)
     > (select amount from supplier_credit where id = NEW.supplier_credit_id) then
    raise exception 'More would be set against credit % than it is for',
      (select credit_no from supplier_credit where id = NEW.supplier_credit_id) using errcode = 'check_violation';
  end if;
  update purchase_invoice set paid_amount = paid_amount where id = NEW.purchase_invoice_id;
  return null;
end $$;
drop trigger if exists supplier_credit_allocation_retotal on supplier_credit_allocation;
create trigger supplier_credit_allocation_retotal after insert on supplier_credit_allocation
  for each row execute function trg_supplier_credit_allocation();

-- 0014's bill guard: paid is what was paid and what credits were set against
-- it; a bill with either is not cancelled.
create or replace function trg_purchase_invoice_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'Bills are append-only; record a credit note instead' using errcode = 'check_violation';
  end if;
  if TG_OP = 'INSERT' then
    NEW.legacy := false;
    NEW.cancelled_at := null;
    NEW.cancel_reason := null;
  elsif (to_jsonb(NEW) - 'paid_amount' - 'is_paid' - 'cancelled_at' - 'cancel_reason')
        is distinct from (to_jsonb(OLD) - 'paid_amount' - 'is_paid' - 'cancelled_at' - 'cancel_reason') then
    raise exception 'A bill''s supplier, number, date and amount cannot change' using errcode = 'check_violation';
  elsif (NEW.cancelled_at, NEW.cancel_reason) is distinct from (OLD.cancelled_at, OLD.cancel_reason) then
    -- Cancelling is one-way, needs a reason, and only for a bill nothing was paid on or set against.
    if OLD.cancelled_at is not null then
      raise exception 'This bill is already cancelled' using errcode = 'check_violation';
    end if;
    if NEW.cancelled_at is null or nullif(trim(NEW.cancel_reason), '') is null then
      raise exception 'Cancelling a bill needs a date and a reason' using errcode = 'check_violation';
    end if;
    if exists (select 1 from supplier_payment where purchase_invoice_id = NEW.id) then
      raise exception 'A bill with payments against it cannot be cancelled' using errcode = 'check_violation';
    end if;
    if exists (select 1 from supplier_credit_allocation where purchase_invoice_id = NEW.id) then
      raise exception 'A bill with credits set against it cannot be cancelled' using errcode = 'check_violation';
    end if;
  end if;
  NEW.paid_amount := coalesce((select sum(amount) from supplier_payment where purchase_invoice_id = NEW.id), 0)
                     + coalesce((select sum(amount) from supplier_credit_allocation where purchase_invoice_id = NEW.id), 0);
  NEW.is_paid := NEW.paid_amount >= NEW.amount_total;
  if NEW.paid_amount > NEW.amount_total then
    raise exception 'Payments of % would exceed the bill total of %', NEW.paid_amount, NEW.amount_total
      using errcode = 'check_violation';
  end if;
  return NEW;
end $$;

-- 0015's cancel_bill (its work, since 0035): not with credits set against it.
create or replace function cancel_bill__run(p_bill uuid, p_reason text, p_date date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  b purchase_invoice; v_day date; v_at timestamptz; v_rev uuid;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the bill is being cancelled'; end if;
  select * into b from purchase_invoice where id = p_bill and business_id = v_business for update;
  if not found then raise exception 'Bill not found'; end if;
  if b.cancelled_at is not null then raise exception 'This bill is already cancelled'; end if;
  if exists (select 1 from supplier_payment where purchase_invoice_id = p_bill) then
    raise exception 'This bill has payments against it, so it cannot be cancelled';
  end if;
  if exists (select 1 from supplier_credit_allocation where purchase_invoice_id = p_bill) then
    raise exception 'This bill has credits set against it, so it cannot be cancelled';
  end if;
  v_day := coalesce(p_date, business_local_date(v_business, now()));
  if v_day > business_local_date(v_business, now()) then raise exception 'Choose a date that has happened'; end if;
  if v_day < b.invoice_date then raise exception 'A bill cannot be cancelled before its own date'; end if;
  v_at := (v_day + time '12:00') at time zone (select timezone from business where id = v_business);
  if b.journal_entry_id is not null
     and exists (select 1 from journal_entry where id = b.journal_entry_id and status = 'published')
     and not exists (select 1 from journal_entry where reverses_entry = b.journal_entry_id) then
    v_rev := reverse_entry_internal(b.journal_entry_id, v_at,
                                    'Cancelled bill ' || coalesce(b.invoice_no, '') || ': ' || trim(p_reason));
  end if;
  update purchase_invoice set cancelled_at = v_at, cancel_reason = trim(p_reason) where id = p_bill;
  perform audit_event(v_business, 'bill.cancel', 'purchase_invoice', p_bill::text, p_reason,
    jsonb_build_object('invoice_no', b.invoice_no, 'amount', b.amount_total, 'legacy', b.legacy),
    jsonb_build_object('reversal', v_rev));
  return jsonb_build_object('journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

-- 0038's GRNI of a delivery, with the goods returned from it before its bill
-- (what its bill must clear is what was kept).
create or replace function receipt_grni_value_at(p_receipt uuid, p_at timestamptz) returns numeric
language sql stable set search_path = public as $$
  select coalesce((select sum(jl.credit)
                     from journal_entry je
                     join journal_line jl on jl.journal_entry_id = je.id
                     join gl_account a on a.id = jl.account_id and a.code = '2050'
                    where je.reference_type = 'goods_receipt' and je.reference_id = p_receipt
                      and je.status = 'published' and je.reverses_entry is null and je.occurred_at < p_at), 0)
       + coalesce((select sum(jl.credit - jl.debit)
                     from receipt_correction c
                     join journal_entry je on je.id = c.journal_entry_id
                     join journal_line jl on jl.journal_entry_id = je.id
                     join gl_account a on a.id = jl.account_id and a.code = '2050'
                    where c.goods_receipt_id = p_receipt and je.status = 'published' and je.occurred_at < p_at), 0)
       + coalesce((select sum(jl.credit - jl.debit)
                     from supplier_return sr
                     join journal_entry je on je.id = sr.journal_entry_id
                     join journal_line jl on jl.journal_entry_id = je.id
                     join gl_account a on a.id = jl.account_id and a.code = '2050'
                    where sr.goods_receipt_id = p_receipt and je.status = 'published' and je.occurred_at < p_at), 0)
$$;

create or replace function return_to_supplier__run(p_supplier uuid, p_lines jsonb, p_reason text, p_receipt uuid,
                                                   p_location uuid, p_confirm boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.receive', 'purchase.create');
  v_me uuid := (current_member()).id;
  v_reason text := nullif(trim(p_reason), '');
  r goods_receipt; v_state jsonb; v_location uuid; v_bill purchase_invoice; v_against text := 'account';
  l jsonb; x jsonb; it item; p record; v_qty numeric; v_unit text; v_base numeric;
  v_items uuid[] := '{}'; v_plan jsonb := '[]'; v_lines jsonb := '[]'; v_below jsonb := '[]';
  v_had_base numeric; v_had_value numeric; v_gone_base numeric; v_gone_value numeric;
  v_value numeric; v_stock numeric; v_total numeric := 0; v_stock_total numeric := 0;
  v_id uuid := gen_random_uuid(); v_no bigint; v_journal uuid; v_mv uuid; v_supplier text;
  v_credit uuid; v_credit_no bigint; v_alloc numeric := 0;
begin
  if v_reason is null then raise exception 'Say why the goods are going back'; end if;
  select name into v_supplier from supplier where id = p_supplier and business_id = v_business;
  if not found then raise exception 'Choose a supplier'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one line';
  end if;
  if p_receipt is not null then
    select * into r from goods_receipt where id = p_receipt and business_id = v_business for update;
    if not found then raise exception 'Delivery not found'; end if;
    if not exists (select 1 from journal_entry where reference_type = 'goods_receipt' and reference_id = p_receipt
                     and status = 'published' and not legacy) then
      raise exception 'Delivery % was received before the controls: return its goods without naming it',
        coalesce(r.receipt_no::text, '');
    end if;
    v_state := receipt_state(p_receipt);
    if coalesce((v_state ->> 'reversed')::boolean, false) then
      raise exception 'Delivery % was reversed: nothing of it is left to return', r.receipt_no;
    end if;
    if (v_state ->> 'supplier_id')::uuid is distinct from p_supplier then
      raise exception 'Delivery % came from another supplier', r.receipt_no;
    end if;
    if p_location is not null and p_location <> r.location_id then
      raise exception 'Delivery % came into %: return its goods from there', r.receipt_no,
        (select name from location where id = r.location_id);
    end if;
    v_location := r.location_id;
    select * into v_bill from purchase_invoice where goods_receipt_id = p_receipt and cancelled_at is null
       for update;
    -- Not yet billed: the return comes off what the bill will clear.
    if v_bill.id is null then v_against := 'delivery'; end if;
  else
    v_location := resolve_location(v_business, p_location);
  end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    select * into it from item where id = (l ->> 'item_id')::uuid and business_id = v_business;
    if not found then raise exception 'Unknown item on the return'; end if;
    if exists (select 1 from jsonb_array_elements(v_plan) y where (y ->> 'item_id')::uuid = it.id) then
      raise exception '% is on the return twice: one line for it', it.name;
    end if;
    v_qty := (l ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Every line needs a quantity'; end if;
    v_unit := coalesce(nullif(l ->> 'unit_code', ''), it.base_unit_code);
    v_base := to_base_qty(it.id, v_qty, v_unit);
    v_items := v_items || it.id;
    v_plan := v_plan || jsonb_build_object('item_id', it.id, 'name', it.name, 'unit', it.base_unit_code,
                                           'qty', v_qty, 'unit_code', v_unit, 'base_qty', v_base);
  end loop;
  perform lock_items(v_items);

  for x in select * from jsonb_array_elements(v_plan) loop
    v_base := (x ->> 'base_qty')::numeric;
    p := item_position(v_business, (x ->> 'item_id')::uuid, v_location);
    -- The stock leaves at its cost now; the last of it with the rest of its value.
    v_stock := case when p.qty > 0 and v_base = p.qty then greatest(p.value, 0)
                    else money_round(v_business, v_base * item_issue_cost(v_business, (x ->> 'item_id')::uuid, v_location))
               end;
    if p_receipt is not null then
      select coalesce(sum((e ->> 'base_qty')::numeric), 0), coalesce(sum((e ->> 'landed')::numeric), 0)
        into v_had_base, v_had_value
        from jsonb_array_elements(v_state -> 'lines') e where (e ->> 'item_id')::uuid = (x ->> 'item_id')::uuid;
      if v_had_base <= 0 then
        raise exception '% did not come in delivery %', x ->> 'name', r.receipt_no;
      end if;
      select coalesce(sum(rl.base_qty), 0), coalesce(sum(rl.value), 0) into v_gone_base, v_gone_value
        from supplier_return_line rl join supplier_return sr on sr.id = rl.supplier_return_id
       where sr.goods_receipt_id = p_receipt and rl.item_id = (x ->> 'item_id')::uuid;
      if v_base > v_had_base - v_gone_base then
        raise exception 'Only % % of % from delivery % is left to return', trim_scale(v_had_base - v_gone_base),
          x ->> 'unit', x ->> 'name', r.receipt_no;
      end if;
      -- What the supplier charged for it: its share of the delivery; the last of it, the rest.
      v_value := case when v_base = v_had_base - v_gone_base then v_had_value - v_gone_value
                      else money_round(v_business, v_had_value * v_base / v_had_base) end;
    else
      v_value := v_stock;
    end if;
    if p.qty - v_base < 0 then
      v_below := v_below || jsonb_build_object('item_id', x ->> 'item_id', 'name', x ->> 'name',
                                               'on_hand_after', p.qty - v_base, 'unit', x ->> 'unit');
    end if;
    v_lines := v_lines || (x || jsonb_build_object('value', v_value, 'stock_value', v_stock));
    v_total := v_total + v_value;
    v_stock_total := v_stock_total + v_stock;
  end loop;

  -- An item whose rule refuses stock below zero is not taken below it (0040).
  if exists (select 1 from jsonb_array_elements(v_below) e
              where rule_value(v_business, 'negative_stock', (e ->> 'item_id')::uuid) #>> '{}' = 'block') then
    raise exception 'This leaves % below zero, which its rule refuses: count it, or return less',
      (select string_agg(format('%s (%s %s)', e ->> 'name', trim_scale((e ->> 'on_hand_after')::numeric), e ->> 'unit'), ', ')
         from jsonb_array_elements(v_below) e
        where rule_value(v_business, 'negative_stock', (e ->> 'item_id')::uuid) #>> '{}' = 'block');
  end if;
  if jsonb_array_length(v_below) > 0 and not coalesce(p_confirm, false) then
    raise exception 'This leaves % below zero: confirm to return it all the same',
      (select string_agg(format('%s (%s %s)', e ->> 'name', trim_scale((e ->> 'on_hand_after')::numeric), e ->> 'unit'), ', ')
         from jsonb_array_elements(v_below) e);
  end if;

  v_no := next_document_no(v_business, 'supplier_return', 1);
  if v_total <> 0 or v_stock_total <> 0 then
    v_journal := post_journal(v_business, now(), 'Return ' || v_no || ' to ' || v_supplier || ': ' || v_reason,
      'supplier_return', v_id,
      jsonb_build_array(signed_line(case v_against when 'delivery' then '2050' else '2000' end, v_total),
                        signed_line('1200', -v_stock_total),
                        signed_line('5050', v_stock_total - v_total)));
  end if;
  insert into supplier_return (id, business_id, return_no, supplier_id, goods_receipt_id, location_id, reason, value,
                               stock_value, against, journal_entry_id, created_by)
  values (v_id, v_business, v_no, p_supplier, p_receipt, v_location, v_reason, v_total, v_stock_total, v_against,
          v_journal, v_me);
  for x in select * from jsonb_array_elements(v_lines) loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason)
    values (v_business, (x ->> 'item_id')::uuid, v_location, 'supplier_return', -(x ->> 'base_qty')::numeric,
            (x ->> 'stock_value')::numeric / (x ->> 'base_qty')::numeric, (x ->> 'stock_value')::numeric,
            'supplier_return', v_id, v_me, 'Return ' || v_no || ': ' || v_reason)
    returning id into v_mv;
    insert into supplier_return_line (business_id, supplier_return_id, item_id, qty, unit_code, base_qty, value,
                                      stock_value, movement_id)
    values (v_business, v_id, (x ->> 'item_id')::uuid, (x ->> 'qty')::numeric, x ->> 'unit_code',
            (x ->> 'base_qty')::numeric, (x ->> 'value')::numeric, (x ->> 'stock_value')::numeric, v_mv);
  end loop;

  -- Owed back on the account: a credit, set against the delivery's bill as far as it is still owed.
  if v_against = 'account' and v_total > 0 then
    v_credit_no := next_document_no(v_business, 'supplier_credit', 1);
    insert into supplier_credit (business_id, credit_no, supplier_id, kind, amount, credit_date, reason,
                                 goods_receipt_id, purchase_invoice_id, supplier_return_id, journal_entry_id, created_by)
    values (v_business, v_credit_no, p_supplier, 'goods_return', v_total, business_local_date(v_business, now()),
            v_reason, p_receipt, v_bill.id, v_id, v_journal, v_me)
    returning id into v_credit;
    if v_bill.id is not null then
      v_alloc := least(v_total, v_bill.amount_total - v_bill.paid_amount);
      if v_alloc > 0 then
        insert into supplier_credit_allocation (business_id, supplier_credit_id, purchase_invoice_id, amount, created_by)
        values (v_business, v_credit, v_bill.id, v_alloc, v_me);
      end if;
    end if;
  end if;

  perform audit_event(v_business, 'purchase.return', 'supplier_return', v_id::text, v_reason, null,
    jsonb_build_object('return_no', v_no, 'supplier', p_supplier, 'receipt_no', r.receipt_no, 'returned', v_lines,
                       'value', v_total, 'stock_value', v_stock_total, 'against', v_against,
                       'credit_no', v_credit_no, 'set_against_bill', v_alloc));
  return jsonb_build_object('return_id', v_id, 'return_no', v_no, 'value', v_total, 'stock_value', v_stock_total,
    'variance', v_stock_total - v_total, 'against', v_against, 'credit_id', v_credit, 'credit_no', v_credit_no,
    'set_against_bill', v_alloc, 'bill_no', v_bill.invoice_no, 'lines', v_lines,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

create or replace function return_to_supplier(p_supplier uuid, p_lines jsonb, p_reason text,
                                              p_receipt uuid default null, p_location uuid default null,
                                              p_confirm boolean default false, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_supplier', p_supplier, 'p_lines', p_lines, 'p_reason', p_reason,
                                    'p_receipt', p_receipt, 'p_location', p_location, 'p_confirm', p_confirm);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'return_to_supplier', v_req);
  if v is not null then return v; end if;
  v := return_to_supplier__run(p_supplier => p_supplier, p_lines => p_lines, p_reason => p_reason,
                               p_receipt => p_receipt, p_location => p_location, p_confirm => p_confirm);
  perform idem_finish(v_business, p_idempotency_key, 'return_to_supplier', v_req, v);
  return v;
end $$;

-- A credit set against a bill of the same supplier, as far as both allow:
-- what is left of the credit, and what is still owed on the bill.
create or replace function set_credit_against(p_business uuid, p_credit uuid, p_bill uuid, p_amount numeric,
                                              p_by uuid, p_strict boolean)
returns numeric language plpgsql set search_path = public as $$
declare c supplier_credit; b purchase_invoice; v_left numeric; v_owed numeric; v_amount numeric;
begin
  select * into c from supplier_credit where id = p_credit and business_id = p_business for update;
  if not found then raise exception 'Credit not found'; end if;
  select * into b from purchase_invoice where id = p_bill and business_id = p_business for update;
  if not found then raise exception 'Bill not found'; end if;
  if b.supplier_id <> c.supplier_id then raise exception 'That bill is from another supplier'; end if;
  if b.cancelled_at is not null then raise exception 'That bill was cancelled; it is not owed'; end if;
  v_left := c.amount - coalesce((select sum(amount) from supplier_credit_allocation where supplier_credit_id = c.id), 0);
  v_owed := b.amount_total - b.paid_amount;
  v_amount := money_round(p_business, coalesce(p_amount, least(v_left, v_owed)));
  if p_strict then
    if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
    if v_amount > v_left then
      raise exception 'That is more than the % left of credit %', trim_scale(v_left), c.credit_no;
    end if;
    if v_amount > v_owed then
      raise exception 'That is more than the % outstanding on bill %', trim_scale(v_owed), b.invoice_no;
    end if;
  else
    v_amount := least(v_amount, v_left, v_owed);
  end if;
  if v_amount > 0 then
    insert into supplier_credit_allocation (business_id, supplier_credit_id, purchase_invoice_id, amount, created_by)
    values (p_business, c.id, b.id, v_amount, p_by);
  end if;
  return greatest(v_amount, 0);
end $$;

-- The supplier's credit note: for a price (against a delivery that was
-- billed: the stock still on hand from it is revalued, and what was used
-- since goes to the price variance), or other (against an account, the bill's
-- own account when it names a bill for a service). Set against the bill named,
-- or the delivery's, as far as it is still owed.
create or replace function record_supplier_credit__run(p_supplier uuid, p_kind text, p_amount numeric,
                                                       p_supplier_ref text, p_reason text, p_receipt uuid,
                                                       p_bill uuid, p_account_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'accounting.post');
  v_me uuid := (current_member()).id;
  v_kind text := lower(nullif(trim(p_kind), '')); v_ref text := nullif(trim(p_supplier_ref), '');
  v_reason text := nullif(trim(p_reason), ''); v_amount numeric; v_day date; v_account text;
  r goods_receipt; v_state jsonb; b purchase_invoice; acct gl_account;
  v_id uuid := gen_random_uuid(); v_no bigint; v_journal uuid; v_lines jsonb; v_alloc numeric := 0;
  v_items uuid[]; v_values numeric[]; v_after numeric[]; v_worth numeric; v_taken numeric; i int; p record;
  v_share numeric; v_on numeric; v_stock numeric := 0; v_part numeric; v_moves jsonb := '[]'; x jsonb;
begin
  if v_kind is null or v_kind not in ('price', 'other', 'goods_return') then
    raise exception 'Say what the credit is for: a price, or other';
  end if;
  if v_kind = 'goods_return' then
    raise exception 'A return makes its own credit: record the supplier''s note on it instead';
  end if;
  if not exists (select 1 from supplier where id = p_supplier and business_id = v_business) then
    raise exception 'Choose a supplier';
  end if;
  if v_ref is null then raise exception 'Type the number on the supplier''s credit note'; end if;
  if exists (select 1 from supplier_credit where business_id = v_business and supplier_id = p_supplier
               and lower(supplier_ref) = lower(v_ref)) then
    raise exception 'Credit note % from this supplier is already recorded', v_ref;
  end if;
  if v_reason is null then raise exception 'Say what the credit is for'; end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  v_day := business_local_date(v_business, now());
  if p_bill is not null then
    select * into b from purchase_invoice where id = p_bill and business_id = v_business;
    if not found then raise exception 'Bill not found'; end if;
    if b.supplier_id <> p_supplier then raise exception 'That bill is from another supplier'; end if;
    if b.cancelled_at is not null then raise exception 'That bill was cancelled; it is not owed'; end if;
  end if;

  if v_kind = 'price' then
    if p_receipt is null then raise exception 'Choose the delivery the price was for'; end if;
    select * into r from goods_receipt where id = p_receipt and business_id = v_business for update;
    if not found then raise exception 'Delivery not found'; end if;
    v_state := receipt_state(p_receipt);
    if (v_state ->> 'supplier_id')::uuid is distinct from p_supplier then
      raise exception 'Delivery % came from another supplier', coalesce(r.receipt_no::text, '');
    end if;
    if coalesce((v_state ->> 'reversed')::boolean, false) then
      raise exception 'Delivery % was reversed: there is no price to reduce', r.receipt_no;
    end if;
    if p_bill is null then
      select * into b from purchase_invoice where goods_receipt_id = p_receipt and cancelled_at is null;
    elsif b.goods_receipt_id is distinct from p_receipt then
      raise exception 'Bill % is not for delivery %', b.invoice_no, r.receipt_no;
    end if;
    if b.id is null then
      raise exception 'Delivery % is not billed yet: correct its price on Purchasing instead', r.receipt_no;
    end if;
    -- What the delivery is still worth to the supplier: its value less what went back and earlier credits.
    select array_agg(g.item_id order by g.item_id), array_agg(g.v order by g.item_id), coalesce(sum(g.v), 0)
      into v_items, v_values, v_worth
      from (select (e ->> 'item_id')::uuid as item_id, sum((e ->> 'landed')::numeric) as v
              from jsonb_array_elements(v_state -> 'lines') e group by 1) g
     where g.v > 0;
    v_taken := coalesce((select sum(value) from supplier_return where goods_receipt_id = p_receipt), 0)
               + coalesce((select sum(amount) from supplier_credit where goods_receipt_id = p_receipt and kind = 'price'), 0);
    if v_worth - v_taken <= 0 or v_amount > v_worth - v_taken then
      raise exception 'That is more than delivery % is still worth (%)', r.receipt_no,
        trim_scale(greatest(v_worth - v_taken, 0));
    end if;
    -- Shared over its items by value; each item's share still on hand revalues it, the rest is variance.
    v_after := allocate_landed(v_business, v_values, -v_amount);
    perform lock_items(v_items);
    for i in 1 .. cardinality(v_items) loop
      v_share := v_values[i] - v_after[i];
      p := item_position(v_business, v_items[i], r.location_id);
      v_on := receipt_share_on_hand(v_business, p_receipt, v_items[i], r.location_id);
      v_part := case when p.qty > 0 and p.value > 0
                     then least(money_round(v_business, v_share * v_on), p.value) else 0 end;
      if v_part > 0 then
        v_moves := v_moves || jsonb_build_object('item_id', v_items[i], 'qty', p.qty, 'from', p.value,
                                                 'to', p.value - v_part);
      end if;
      v_stock := v_stock + v_part;
    end loop;
    v_lines := jsonb_build_array(signed_line('2000', v_amount), signed_line('1200', -v_stock),
                                 signed_line('5050', v_stock - v_amount));
  else
    v_account := coalesce(nullif(trim(p_account_code), ''), b.expense_account_code);
    if v_account is null then raise exception 'Choose the account the credit is taken off'; end if;
    select * into acct from gl_account where business_id = v_business and code = v_account and is_active;
    if not found or acct.account_type not in ('expense', 'asset')
       or v_account in ('1000', '1001', '1005', '1006', '1010', '1020', '1100', '1200', '5000', '5300', '5400') then
      raise exception 'Account % cannot take a supplier''s credit', v_account;
    end if;
    v_lines := jsonb_build_array(signed_line('2000', v_amount), signed_line(v_account, -v_amount));
  end if;

  v_no := next_document_no(v_business, 'supplier_credit', 1);
  v_journal := post_journal(v_business, now(),
    'Credit ' || v_no || ' from ' || (select name from supplier where id = p_supplier) || ' (' || v_ref || '): ' || v_reason,
    'supplier_credit', v_id, v_lines, null, v_ref);
  insert into supplier_credit (id, business_id, credit_no, supplier_id, kind, amount, credit_date, supplier_ref, reason,
                               goods_receipt_id, purchase_invoice_id, account_code, journal_entry_id, matched_at,
                               matched_by, created_by)
  values (v_id, v_business, v_no, p_supplier, v_kind, v_amount, v_day, v_ref, v_reason, p_receipt, b.id, v_account,
          v_journal, now(), v_me, v_me);
  for x in select * from jsonb_array_elements(v_moves) loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason)
    values (v_business, (x ->> 'item_id')::uuid, r.location_id, 'cost_adjustment', -(x ->> 'qty')::numeric,
            (x ->> 'from')::numeric / (x ->> 'qty')::numeric, (x ->> 'from')::numeric,
            'supplier_credit', v_id, v_me, 'Revalued: credit ' || v_no || ' on delivery ' || r.receipt_no),
           (v_business, (x ->> 'item_id')::uuid, r.location_id, 'cost_adjustment', (x ->> 'qty')::numeric,
            (x ->> 'to')::numeric / (x ->> 'qty')::numeric, (x ->> 'to')::numeric,
            'supplier_credit', v_id, v_me, 'Revalued: credit ' || v_no || ' on delivery ' || r.receipt_no);
  end loop;
  if b.id is not null then
    v_alloc := set_credit_against(v_business, v_id, b.id, null, v_me, false);
  end if;
  perform audit_event(v_business, 'purchase.credit', 'supplier_credit', v_id::text, v_reason, null,
    jsonb_build_object('credit_no', v_no, 'supplier', p_supplier, 'credit_kind', v_kind, 'amount', v_amount,
                       'supplier_ref', v_ref, 'receipt_no', r.receipt_no, 'bill', b.invoice_no,
                       'account', v_account, 'stock_change', -v_stock, 'set_against_bill', v_alloc));
  return jsonb_build_object('credit_id', v_id, 'credit_no', v_no, 'kind', v_kind, 'amount', v_amount,
    'stock', -v_stock, 'variance', case when v_kind = 'price' then v_stock - v_amount else 0 end,
    'set_against_bill', v_alloc, 'bill_no', b.invoice_no,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

create or replace function record_supplier_credit(p_supplier uuid, p_kind text, p_amount numeric, p_supplier_ref text,
                                                  p_reason text, p_receipt uuid default null, p_bill uuid default null,
                                                  p_account_code text default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_supplier', p_supplier, 'p_kind', p_kind, 'p_amount', p_amount,
                                    'p_supplier_ref', p_supplier_ref, 'p_reason', p_reason,
                                    'p_receipt', p_receipt, 'p_bill', p_bill, 'p_account_code', p_account_code);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_supplier_credit', v_req);
  if v is not null then return v; end if;
  v := record_supplier_credit__run(p_supplier => p_supplier, p_kind => p_kind, p_amount => p_amount,
                                   p_supplier_ref => p_supplier_ref, p_reason => p_reason, p_receipt => p_receipt,
                                   p_bill => p_bill, p_account_code => p_account_code);
  perform idem_finish(v_business, p_idempotency_key, 'record_supplier_credit', v_req, v);
  return v;
end $$;

-- The supplier's note for goods returned after the bill: its number, on the
-- credit the return made. Nothing is posted again.
create or replace function note_supplier_credit__run(p_credit uuid, p_supplier_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'accounting.post');
  v_me uuid := (current_member()).id;
  c supplier_credit; v_ref text := nullif(trim(p_supplier_ref), '');
begin
  if v_ref is null then raise exception 'Type the number on the supplier''s credit note'; end if;
  select * into c from supplier_credit where id = p_credit and business_id = v_business for update;
  if not found then raise exception 'Credit not found'; end if;
  if c.supplier_ref is not null then
    raise exception 'Credit % already has the supplier''s note %', c.credit_no, c.supplier_ref;
  end if;
  if exists (select 1 from supplier_credit where business_id = v_business and supplier_id = c.supplier_id
               and lower(supplier_ref) = lower(v_ref)) then
    raise exception 'Credit note % from this supplier is already recorded', v_ref;
  end if;
  update supplier_credit set supplier_ref = v_ref, matched_at = now(), matched_by = v_me where id = c.id;
  perform audit_event(v_business, 'purchase.credit.note', 'supplier_credit', c.id::text, null, null,
    jsonb_build_object('credit_no', c.credit_no, 'supplier_ref', v_ref, 'amount', c.amount));
  return jsonb_build_object('credit_id', c.id, 'credit_no', c.credit_no, 'supplier_ref', v_ref);
end $$;

create or replace function note_supplier_credit(p_credit uuid, p_supplier_ref text, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_credit', p_credit, 'p_supplier_ref', p_supplier_ref);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'note_supplier_credit', v_req);
  if v is not null then return v; end if;
  v := note_supplier_credit__run(p_credit => p_credit, p_supplier_ref => p_supplier_ref);
  perform idem_finish(v_business, p_idempotency_key, 'note_supplier_credit', v_req, v);
  return v;
end $$;

-- What is left of a credit, set against a bill of the same supplier: as a
-- payment is (accounting.post), never more than either has.
create or replace function allocate_credit__run(p_credit uuid, p_bill uuid, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_me uuid := (current_member()).id;
  v_amount numeric; c supplier_credit; b purchase_invoice;
begin
  v_amount := set_credit_against(v_business, p_credit, p_bill, coalesce(p_amount, -1), v_me, true);
  select * into c from supplier_credit where id = p_credit;
  select * into b from purchase_invoice where id = p_bill;
  perform audit_event(v_business, 'purchase.credit.allocate', 'supplier_credit', c.id::text, null, null,
    jsonb_build_object('credit_no', c.credit_no, 'bill', b.invoice_no, 'amount', v_amount));
  return jsonb_build_object('credit_id', c.id, 'credit_no', c.credit_no, 'bill_id', b.id, 'bill_no', b.invoice_no,
    'amount', v_amount,
    'credit_left', c.amount - (select coalesce(sum(amount), 0) from supplier_credit_allocation where supplier_credit_id = c.id),
    'bill_outstanding', b.amount_total - b.paid_amount);
end $$;

create or replace function allocate_credit(p_credit uuid, p_bill uuid, p_amount numeric,
                                           p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_credit', p_credit, 'p_bill', p_bill, 'p_amount', p_amount);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'allocate_credit', v_req);
  if v is not null then return v; end if;
  v := allocate_credit__run(p_credit => p_credit, p_bill => p_bill, p_amount => p_amount);
  perform idem_finish(v_business, p_idempotency_key, 'allocate_credit', v_req, v);
  return v;
end $$;

-- 0043's record_bill (its work): a delivery all of which went back before its
-- bill has nothing to bill.
create or replace function record_bill__run(
  p_supplier uuid, p_invoice_no text, p_invoice_date date, p_amount numeric, p_term_days int default 0,
  p_receipt uuid default null, p_account_code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('purchase.create', 'accounting.post');
  v_amount numeric; v_grni numeric; v_legacy numeric; v_ppv numeric; v_bill uuid; v_journal uuid; v_lines jsonb;
  v_acct gl_account; v_state jsonb;
  v_no text := nullif(trim(p_invoice_no), '');
begin
  if not exists (select 1 from supplier where id = p_supplier and business_id = v_business) then
    raise exception 'Choose a supplier';
  end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if (p_receipt is null) = (p_account_code is null) then
    raise exception 'A bill is either for a goods receipt or for an expense account — choose one';
  end if;
  if v_no is null then
    v_no := bill_number_take(v_business);
  elsif is_own_bill_number(v_business, v_no) then
    raise exception 'Numbers like % are the café''s own and are given automatically: leave the box as it is, or type the supplier''s invoice number', v_no;
  end if;
  -- Against every bill ever entered, including those before the controls (M-07).
  if exists (select 1 from purchase_invoice where business_id = v_business and supplier_id = p_supplier
               and lower(invoice_no) = lower(v_no) and cancelled_at is null) then
    raise exception 'Invoice % from this supplier is already recorded', v_no;
  end if;

  v_bill := gen_random_uuid();
  if p_receipt is not null then
    perform 1 from goods_receipt where id = p_receipt and business_id = v_business for update;
    if not found then raise exception 'Receipt not found'; end if;
    v_state := receipt_state(p_receipt);
    if coalesce((v_state ->> 'reversed')::boolean, false) then
      raise exception 'That delivery was reversed: there is nothing to bill';
    end if;
    -- The old app did not record the supplier on a receipt; any supplier may bill those.
    if (v_state ->> 'supplier_id') is not null and (v_state ->> 'supplier_id')::uuid <> p_supplier then
      raise exception 'That receipt is from a different supplier';
    end if;
    if exists (select 1 from purchase_invoice where goods_receipt_id = p_receipt and cancelled_at is null) then
      raise exception 'That receipt has already been billed';
    end if;
    v_grni := receipt_grni_value(p_receipt);
    if v_grni <= 0 and exists (select 1 from supplier_return where goods_receipt_id = p_receipt and against = 'delivery') then
      raise exception 'Everything delivery % brought went back to the supplier: there is nothing to bill',
        (select receipt_no from goods_receipt where id = p_receipt);
    end if;
    if v_grni > 0 then
      v_ppv := v_amount - v_grni;
      v_lines := jsonb_build_array(
        jsonb_build_object('code', '2050', 'debit', v_grni),
        jsonb_build_object('code', '5050', 'debit', greatest(v_ppv, 0), 'credit', greatest(-v_ppv, 0)),
        jsonb_build_object('code', '2000', 'credit', v_amount));
    else
      v_legacy := receipt_legacy_payable(p_receipt);
      if v_legacy <= 0 then
        raise exception 'That receipt has no payable to bill against: its journal was reversed or never written (see docs/REMEDIATION.md)';
      end if;
      v_ppv := v_amount - v_legacy;
      v_lines := case when v_ppv <> 0 then jsonb_build_array(
        jsonb_build_object('code', '5050', 'debit', greatest(v_ppv, 0), 'credit', greatest(-v_ppv, 0)),
        jsonb_build_object('code', '2000', 'debit', greatest(-v_ppv, 0), 'credit', greatest(v_ppv, 0))) end;
    end if;
  else
    select * into v_acct from gl_account where business_id = v_business and code = p_account_code and is_active;
    if not found or v_acct.account_type not in ('expense', 'asset')
       or p_account_code in ('1000', '1001', '1005', '1006', '1010', '1020', '1100', '1200', '5000', '5050',
                          '5300', '5400') then
      raise exception 'Account % cannot take a bill; stock is billed against its goods receipt', p_account_code;
    end if;
    v_lines := jsonb_build_array(
      jsonb_build_object('code', p_account_code, 'debit', v_amount),
      jsonb_build_object('code', '2000', 'credit', v_amount));
  end if;

  if v_lines is not null then
    v_journal := post_journal(v_business, (coalesce(p_invoice_date, business_local_date(v_business, now())) + time '12:00')
                                            at time zone (select timezone from business where id = v_business),
      'Bill ' || v_no, 'purchase_invoice', v_bill, v_lines, null, v_no);
  end if;
  insert into purchase_invoice (id, business_id, supplier_id, invoice_no, invoice_date, due_date, amount_total,
                                goods_receipt_id, expense_account_code, journal_entry_id)
  values (v_bill, v_business, p_supplier, v_no,
          coalesce(p_invoice_date, business_local_date(v_business, now())),
          coalesce(p_invoice_date, business_local_date(v_business, now())) + greatest(coalesce(p_term_days, 0), 0),
          v_amount, p_receipt, p_account_code, v_journal);
  return jsonb_build_object('bill_id', v_bill, 'invoice_no', v_no,
                            'journal_no', (select journal_no from journal_entry where id = v_journal),
                            'price_variance', coalesce(v_ppv, 0));
end $$;

-- 0040's correct_receipt (its work): a delivery some of which went back to the
-- supplier is no longer corrected, and one against an order keeps the order's
-- supplier.
create or replace function correct_receipt__run(p_receipt uuid, p_lines jsonb, p_supplier uuid, p_received_on date,
                                               p_reason text, p_confirm boolean, p_reverse boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('inventory.adjust.approve');
  v_me uuid := (current_member()).id;
  r goods_receipt; v_before jsonb; v_after jsonb; v_kinds text[]; v_plan jsonb; v_reason text := trim(p_reason);
  v_id uuid := gen_random_uuid(); v_no bigint; v_journal uuid; x jsonb; mv jsonb; v_items uuid[]; v_period text;
  v_desc text;
begin
  if nullif(v_reason, '') is null then raise exception 'Say why the delivery is being corrected'; end if;
  select * into r from goods_receipt where id = p_receipt and business_id = v_business for update;
  if not found then raise exception 'Delivery not found'; end if;
  if not exists (select 1 from journal_entry where reference_type = 'goods_receipt' and reference_id = p_receipt
                   and status = 'published' and not legacy) then
    raise exception 'Delivery % was received before the controls: the owner corrects it on Reports', coalesce(r.receipt_no::text, '');
  end if;
  if exists (select 1 from purchase_invoice where goods_receipt_id = p_receipt and cancelled_at is null) then
    raise exception 'Delivery % has been billed: cancel its bill on Vendors first, then correct the delivery', r.receipt_no;
  end if;
  if exists (select 1 from supplier_return where goods_receipt_id = p_receipt) then
    raise exception 'Goods from delivery % have gone back to the supplier: it is no longer corrected', r.receipt_no;
  end if;
  select name into v_period from accounting_period
   where business_id = v_business and status = 'locked'
     and business_local_date(v_business, r.received_at) between starts_on and ends_on;
  if v_period is not null then
    raise exception 'Delivery % is in %, a locked month: it is no longer corrected', r.receipt_no, v_period;
  end if;
  v_before := receipt_state(p_receipt);
  if coalesce((v_before ->> 'reversed')::boolean, false) then
    raise exception 'Delivery % was reversed: receive it again instead', r.receipt_no;
  end if;

  if p_reverse then
    v_after := (v_before - 'lines') || jsonb_build_object('lines', '[]'::jsonb, 'reversed', true);
  else
    v_after := receipt_after_state(v_business, p_receipt, v_before, p_lines, p_supplier, p_received_on);
  end if;
  v_kinds := receipt_change_kinds(v_before, v_after);
  if cardinality(v_kinds) = 0 then raise exception 'Nothing was changed'; end if;
  if r.purchase_order_id is not null and (v_after ->> 'supplier_id') is distinct from (v_before ->> 'supplier_id') then
    raise exception 'Delivery % came against order %: its supplier is the order''s', r.receipt_no,
      (select po_no from purchase_order where id = r.purchase_order_id);
  end if;

  -- Every item the delivery had or has, locked in one order, then the stock read.
  select array_agg(distinct (e ->> 'item_id')::uuid) into v_items
    from (select jsonb_array_elements(v_before -> 'lines') e
          union all select jsonb_array_elements(v_after -> 'lines')) s;
  if v_items is not null then perform lock_items(v_items); end if;
  v_plan := receipt_correction_plan(v_business, p_receipt, v_before, v_after);

  if jsonb_array_length(v_plan -> 'counted_since') > 0 then
    raise exception '% counted after this delivery, and the count set its stock: correct only its price',
      (select string_agg(e ->> 'name', ', ') from jsonb_array_elements(v_plan -> 'counted_since') e);
  end if;
  -- An item whose rule refuses stock below zero is not taken below it (0040).
  if exists (select 1 from jsonb_array_elements(v_plan -> 'below_zero') e
              where rule_value(v_business, 'negative_stock', (e ->> 'item_id')::uuid) #>> '{}' = 'block') then
    raise exception 'This leaves % below zero, which its rule refuses: count it, or correct less',
      (select string_agg(format('%s (%s %s)', e ->> 'name', trim_scale((e ->> 'on_hand_after')::numeric), e ->> 'unit'), ', ')
         from jsonb_array_elements(v_plan -> 'below_zero') e
        where rule_value(v_business, 'negative_stock', (e ->> 'item_id')::uuid) #>> '{}' = 'block');
  end if;
  if jsonb_array_length(v_plan -> 'below_zero') > 0 and not coalesce(p_confirm, false) then
    raise exception 'This leaves % below zero: confirm to correct it all the same',
      (select string_agg(format('%s (%s %s)', e ->> 'name', trim_scale((e ->> 'on_hand_after')::numeric), e ->> 'unit'), ', ')
         from jsonb_array_elements(v_plan -> 'below_zero') e);
  end if;

  v_no := next_document_no(v_business, 'receipt_correction', 1);
  v_desc := case when p_reverse then 'Delivery ' || r.receipt_no || ' reversed (correction ' || v_no || '): '
                 else 'Correction ' || v_no || ' of delivery ' || r.receipt_no || ': ' end || v_reason;
  if (v_plan ->> 'stock')::numeric <> 0 or (v_plan ->> 'grni')::numeric <> 0 then
    v_journal := post_journal(v_business, now(), v_desc, 'receipt_correction', v_id,
      jsonb_build_array(signed_line('1200', (v_plan ->> 'stock')::numeric),
                        signed_line('2050', -(v_plan ->> 'grni')::numeric),
                        signed_line('5050', (v_plan ->> 'variance')::numeric)));
  end if;
  insert into receipt_correction (id, business_id, correction_no, goods_receipt_id, kinds, reason, before_state,
                                  after_state, effects, journal_entry_id, created_by)
  values (v_id, v_business, v_no, p_receipt, v_kinds, v_reason, v_before, v_after, v_plan -> 'items', v_journal, v_me);
  for x in select * from jsonb_array_elements(v_plan -> 'items') loop
    for mv in select * from jsonb_array_elements(x -> 'moves') loop
      insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                      reference_type, reference_id, app_user_id, reason)
      values (v_business, (x ->> 'item_id')::uuid, r.location_id, (mv ->> 'type')::movement_type,
              (mv ->> 'qty')::numeric, (mv ->> 'value')::numeric / abs((mv ->> 'qty')::numeric), (mv ->> 'value')::numeric,
              'receipt_correction', v_id, v_me,
              case when mv ->> 'type' = 'cost_adjustment' then 'Revalued: ' else '' end || v_desc);
    end loop;
  end loop;

  perform audit_event(v_business, case when p_reverse then 'purchase.reverse' else 'purchase.correct' end,
    'goods_receipt', p_receipt::text, v_reason,
    jsonb_build_object('receipt_no', r.receipt_no, 'supplier', v_before -> 'supplier_id',
                       'received_on', v_before -> 'received_on', 'delivery_lines', v_before -> 'lines'),
    jsonb_build_object('correction_no', v_no, 'kinds', to_jsonb(v_kinds), 'supplier', v_after -> 'supplier_id',
                       'received_on', v_after -> 'received_on', 'delivery_lines', v_after -> 'lines',
                       'stock_change', v_plan -> 'stock', 'grni_change', v_plan -> 'grni',
                       'price_variance', v_plan -> 'variance'));
  return jsonb_build_object('correction_id', v_id, 'correction_no', v_no, 'receipt_no', r.receipt_no,
    'kinds', to_jsonb(v_kinds), 'reversed', p_reverse,
    'stock', v_plan -> 'stock', 'grni', v_plan -> 'grni', 'variance', v_plan -> 'variance',
    'items', v_plan -> 'items',
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- ---------------------------------------------------------------------------
-- 5. The supplier's statement, and Reports → Purchasing
-- ---------------------------------------------------------------------------
-- (cost.view) What the café owes a supplier, between two dates: what it owed
-- before them; each bill, cancelled bill, payment and credit in date order,
-- with the balance after it; what it owed at the end. Then, as of now, the
-- bills still owed and the credits not yet all set against bills.
create or replace function supplier_statement(p_supplier uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); s supplier; v_today date; v_out jsonb;
begin
  select * into s from supplier where id = p_supplier and business_id = v_business;
  if not found then raise exception 'Supplier not found'; end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Choose the dates, the first before the last';
  end if;
  v_today := business_local_date(v_business, now());
  with doc as (
    select b.invoice_date as day, 1 as ord, b.created_at as at, 'bill'::text as kind, b.id, b.invoice_no as ref,
           null::text as note, b.amount_total as charge, 0::numeric as credit,
           jsonb_build_object('due', b.due_date, 'legacy', b.legacy,
                              'receipt_no', (select receipt_no from goods_receipt where id = b.goods_receipt_id)) as more
      from purchase_invoice b where b.business_id = v_business and b.supplier_id = p_supplier
    union all
    select business_local_date(v_business, b.cancelled_at), 2, b.cancelled_at, 'cancelled', b.id, b.invoice_no,
           b.cancel_reason, 0, b.amount_total, '{}'::jsonb
      from purchase_invoice b
     where b.business_id = v_business and b.supplier_id = p_supplier and b.cancelled_at is not null
    union all
    select p.paid_on, 3, p.created_at, 'payment', p.id, null, null, 0, p.amount,
           jsonb_build_object('method', p.method, 'bill', (select invoice_no from purchase_invoice where id = p.purchase_invoice_id))
      from supplier_payment p where p.business_id = v_business and p.supplier_id = p_supplier
    union all
    select c.credit_date, 4, c.created_at, 'credit', c.id, c.supplier_ref, c.reason, 0, c.amount,
           jsonb_build_object('credit_no', c.credit_no, 'credit_kind', c.kind,
                              'return_no', (select return_no from supplier_return where id = c.supplier_return_id),
                              'receipt_no', (select receipt_no from goods_receipt where id = c.goods_receipt_id))
      from supplier_credit c where c.business_id = v_business and c.supplier_id = p_supplier
  ),
  before as (select coalesce(sum(charge - credit), 0) as bal from doc where day < p_from),
  inside as (
    select d.*, (select bal from before) + sum(d.charge - d.credit) over (order by d.day, d.ord, d.at, d.id) as balance
      from doc d where d.day between p_from and p_to
  )
  select jsonb_build_object(
    'supplier', jsonb_build_object('id', s.id, 'name', s.name, 'contact', s.contact, 'phone', s.phone),
    'from', p_from, 'to', p_to,
    'opening', (select bal from before),
    'lines', coalesce((select jsonb_agg(jsonb_build_object('date', i.day, 'kind', i.kind, 'id', i.id, 'ref', i.ref,
                                                           'note', i.note, 'charge', i.charge, 'credit', i.credit,
                                                           'balance', i.balance) || i.more
                                        order by i.day, i.ord, i.at, i.id) from inside i), '[]'::jsonb),
    'closing', (select bal from before) + coalesce((select sum(charge - credit) from inside), 0),
    'billed', coalesce((select sum(charge) from inside where kind = 'bill'), 0),
    'cancelled', coalesce((select sum(credit) from inside where kind = 'cancelled'), 0),
    'paid', coalesce((select sum(credit) from inside where kind = 'payment'), 0),
    'credited', coalesce((select sum(credit) from inside where kind = 'credit'), 0),
    'open_bills', coalesce((
      select jsonb_agg(jsonb_build_object(
               'bill_id', b.id, 'invoice_no', b.invoice_no, 'date', b.invoice_date, 'due', b.due_date,
               'total', b.amount_total,
               'paid', coalesce((select sum(amount) from supplier_payment where purchase_invoice_id = b.id), 0),
               'credited', coalesce((select sum(amount) from supplier_credit_allocation where purchase_invoice_id = b.id), 0),
               'outstanding', b.amount_total - b.paid_amount,
               'days_overdue', greatest(v_today - coalesce(b.due_date, b.invoice_date), 0))
             order by b.invoice_date, b.invoice_no)
        from purchase_invoice b
       where b.business_id = v_business and b.supplier_id = p_supplier and b.cancelled_at is null
         and b.amount_total > b.paid_amount), '[]'::jsonb),
    'open_credits', coalesce((
      select jsonb_agg(jsonb_build_object(
               'credit_id', c.id, 'credit_no', c.credit_no, 'date', c.credit_date, 'kind', c.kind,
               'supplier_ref', c.supplier_ref, 'amount', c.amount, 'left', c.amount - a.used)
             order by c.credit_no)
        from supplier_credit c
        cross join lateral (select coalesce(sum(amount), 0) as used from supplier_credit_allocation
                             where supplier_credit_id = c.id) a
       where c.business_id = v_business and c.supplier_id = p_supplier and c.amount > a.used), '[]'::jsonb))
    into v_out;
  return v_out;
end $$;

-- (cost.view) Purchasing in the dates: the orders made, by where they stand,
-- and what came of each; the orders still open; deliveries whose price per
-- unit differs from the supplier's delivery before; the returns and credits.
create or replace function report_purchasing(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); b record;
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Choose the dates, the first before the last';
  end if;
  b := local_day_bounds(v_business, p_from, p_to);
  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'orders', coalesce((select jsonb_agg(jsonb_build_object('po_id', o.id, 'po_no', o.po_no, 'status', o.status,
                                                            'receiving', v ->> 'receiving', 'supplier', v ->> 'supplier',
                                                            'ordered', o.total,
                                                            'received', coalesce((select sum(g.value) from po_received(o.id) g), 0),
                                                            'created_at', o.ordered_at)
                                         order by o.po_no)
                          from purchase_order o cross join lateral po_view(o.id) v
                         where o.business_id = v_business and o.ordered_at >= b.from_ts and o.ordered_at < b.to_ts),
                       '[]'::jsonb),
    'open', coalesce((select jsonb_agg(po_view(o.id) order by o.po_no)
                        from purchase_order o
                       where o.business_id = v_business and o.status in ('approved', 'sent')), '[]'::jsonb),
    'price_changes', coalesce((
      with lines as (
        select r.id as receipt_id, r.receipt_no, r.received_at, (st ->> 'supplier_id')::uuid as supplier_id,
               (e ->> 'item_id')::uuid as item_id,
               sum((e ->> 'goods_value')::numeric) / nullif(sum((e ->> 'base_qty')::numeric), 0) as price
          from goods_receipt r
          cross join lateral receipt_state(r.id) st
          cross join lateral jsonb_array_elements(st -> 'lines') e
         where r.business_id = v_business and r.received_at < b.to_ts
         group by 1, 2, 3, 4, 5
      ),
      seq as (
        select l.*, lag(l.price) over (partition by l.supplier_id, l.item_id order by l.received_at, l.receipt_no) as before
          from lines l
      )
      select jsonb_agg(jsonb_build_object('receipt_no', q.receipt_no, 'received_at', q.received_at,
                                          'supplier', s.name, 'item', i.name, 'unit', i.base_unit_code,
                                          'before', round(q.before, 4), 'now', round(q.price, 4),
                                          'change_percent', round((q.price - q.before) / q.before * 100, 1))
                       order by q.received_at, q.receipt_no, i.name)
        from seq q join item i on i.id = q.item_id left join supplier s on s.id = q.supplier_id
       where q.received_at >= b.from_ts and q.before > 0 and q.price is not null and q.price <> q.before),
      '[]'::jsonb),
    'returns', coalesce((select jsonb_agg(jsonb_build_object(
                            'return_id', x.id, 'return_no', x.return_no, 'at', x.created_at, 'supplier', s.name,
                            'receipt_no', r.receipt_no, 'reason', x.reason, 'value', x.value,
                            'stock_value', x.stock_value, 'against', x.against,
                            'credit_no', (select credit_no from supplier_credit where supplier_return_id = x.id),
                            'lines', (select jsonb_agg(jsonb_build_object('item', i.name, 'qty', rl.qty,
                                                                          'unit_code', rl.unit_code, 'value', rl.value)
                                                       order by i.name)
                                        from supplier_return_line rl join item i on i.id = rl.item_id
                                       where rl.supplier_return_id = x.id))
                          order by x.return_no)
                           from supplier_return x join supplier s on s.id = x.supplier_id
                           left join goods_receipt r on r.id = x.goods_receipt_id
                          where x.business_id = v_business and x.created_at >= b.from_ts and x.created_at < b.to_ts),
                        '[]'::jsonb),
    'credits', coalesce((select jsonb_agg(jsonb_build_object(
                            'credit_id', c.id, 'credit_no', c.credit_no, 'date', c.credit_date, 'supplier', s.name,
                            'kind', c.kind, 'supplier_ref', c.supplier_ref, 'reason', c.reason, 'amount', c.amount,
                            'set_against', a.used, 'left', c.amount - a.used)
                          order by c.credit_no)
                           from supplier_credit c join supplier s on s.id = c.supplier_id
                           cross join lateral (select coalesce(sum(amount), 0) as used from supplier_credit_allocation
                                                where supplier_credit_id = c.id) a
                          where c.business_id = v_business and c.credit_date between p_from and p_to), '[]'::jsonb),
    'totals', jsonb_build_object(
       'returned', coalesce((select sum(value) from supplier_return
                              where business_id = v_business and created_at >= b.from_ts and created_at < b.to_ts), 0),
       'credited', coalesce((select sum(amount) from supplier_credit
                              where business_id = v_business and credit_date between p_from and p_to), 0),
       'credits_left', coalesce((select sum(c.amount - a.used)
                                   from supplier_credit c
                                   cross join lateral (select coalesce(sum(amount), 0) as used
                                                         from supplier_credit_allocation where supplier_credit_id = c.id) a
                                  where c.business_id = v_business), 0)));
end $$;

-- ---------------------------------------------------------------------------
-- 6. The books
-- ---------------------------------------------------------------------------
-- 0043's checks: payables less the suppliers' credits.
create or replace function reconciliation_checks(p_business uuid, p_as_of date)
returns table (check_key text, label text, subledger numeric, ledger numeric, difference numeric)
language plpgsql stable set search_path = public as $$
declare
  v_end timestamptz; v_settled date; v_known boolean := true; v_sum numeric := 0; d record; l record;
  v_unnumbered numeric; v_by_hand numeric;
begin
  v_end := (local_day_bounds(p_business, p_as_of, p_as_of)).to_ts;

  check_key := 'inventory'; label := 'Stock ledger vs Inventory (1200)';
  select coalesce(sum(value * sign(base_quantity_signed)), 0) into subledger
    from inventory_movement where business_id = p_business and occurred_at < v_end;
  ledger := gl_balance_at(p_business, '1200', v_end);
  difference := subledger - ledger; return next;

  check_key := 'payables'; label := 'Unpaid bills vs Accounts payable (2000)';
  select coalesce(sum(amount_total), 0) into subledger
    from purchase_invoice where business_id = p_business and invoice_date < p_as_of + 1
                            and (cancelled_at is null or cancelled_at >= v_end);
  subledger := subledger - coalesce((select sum(amount) from supplier_payment
                                      where business_id = p_business and paid_on < p_as_of + 1), 0);
  -- Less what the suppliers owe back (0044): their credits, set against bills or not.
  subledger := subledger - coalesce((select sum(amount) from supplier_credit
                                      where business_id = p_business and credit_date < p_as_of + 1), 0);
  -- Receipts the old app posted straight to A/P are owed until their bill is recorded.
  subledger := subledger + coalesce((select sum(receipt_legacy_payable(r.id, v_end)) from goods_receipt r
                                      where r.business_id = p_business and r.received_at < v_end
                                        and not exists (select 1 from purchase_invoice p where p.goods_receipt_id = r.id
                                                          and p.invoice_date < p_as_of + 1
                                                          and (p.cancelled_at is null or p.cancelled_at >= v_end))), 0);
  ledger := -gl_balance_at(p_business, '2000', v_end);
  difference := subledger - ledger; return next;

  check_key := 'grni'; label := 'Unbilled receipts vs Goods received not invoiced (2050)';
  select coalesce(sum(receipt_grni_value_at(r.id, v_end)), 0) into subledger
    from goods_receipt r
   where r.business_id = p_business and r.received_at < v_end
     and not exists (select 1 from purchase_invoice p where p.goods_receipt_id = r.id and p.invoice_date < p_as_of + 1
                        and (p.cancelled_at is null or p.cancelled_at >= v_end));
  ledger := -gl_balance_at(p_business, '2050', v_end);
  difference := subledger - ledger; return next;

  check_key := 'sales'; label := 'Sales recorded vs net revenue in the ledger (4000 less 4100 and 4200)';
  select coalesce(sum(net_amount), 0) into subledger
    from sales_order where business_id = p_business and status <> 'voided' and status <> 'open' and placed_at < v_end;
  subledger := subledger - coalesce((select sum(amount) from sale_adjustment
                                      where business_id = p_business and kind = 'refund' and created_at < v_end), 0);
  ledger := -(gl_balance_at(p_business, '4000', v_end) + gl_balance_at(p_business, '4100', v_end)
              + gl_balance_at(p_business, '4200', v_end));
  difference := subledger - ledger; return next;

  -- Card: what the till took by card on the days not yet settled (0030),
  -- against Card clearing. What else sits in 1010 was posted on a day
  -- already settled, and no settlement will ever take it.
  check_key := 'card'; label := 'Card takings not yet settled vs Card clearing (1010)';
  select max(s.covers_to) into v_settled
    from card_settlement s join journal_entry j on j.id = s.journal_entry_id
   where s.business_id = p_business and j.occurred_at < v_end
     and not exists (select 1 from journal_entry rv where rv.reverses_entry = j.id and rv.occurred_at < v_end);
  select coalesce(sum(jl.debit - jl.credit), 0) into subledger
    from journal_line jl join journal_entry e on e.id = jl.journal_entry_id join gl_account g on g.id = jl.account_id
   where e.business_id = p_business and e.status = 'published' and g.code = '1010' and e.occurred_at < v_end
     and e.reference_type is distinct from 'card_settlement'
     and not (e.reference_type = 'reversal'
              and exists (select 1 from journal_entry o where o.id = e.reverses_entry and o.reference_type = 'card_settlement'))
     and (v_settled is null or business_local_date(p_business, e.occurred_at) > v_settled);
  ledger := gl_balance_at(p_business, '1010', v_end);
  difference := subledger - ledger; return next;

  -- Platforms: each platform order not voided, less what was refunded of it
  -- and what a statement has paid out for it, against what they owe (1100).
  -- The platform sales from before order numbers (0030) are on no statement:
  -- a payout typed by hand into 1100 is what explains them, as far as they
  -- go (docs/LIMITATIONS.md). A payout typed by hand beyond them is flagged.
  check_key := 'platform'; label := 'Orders the platforms owe vs Receivable from platforms (1100)';
  select coalesce(sum(o.net_amount
                      - coalesce((select sum(a.amount) from sale_adjustment a
                                   where a.sales_order_id = o.id and a.kind = 'refund' and a.created_at < v_end), 0)
                      - coalesce((select sum(sl.expected) from platform_settlement_line sl
                                    join platform_settlement s on s.id = sl.settlement_id
                                    join journal_entry j on j.id = s.journal_entry_id
                                   where sl.sales_order_id = o.id and sl.status = 'matched' and j.occurred_at < v_end
                                     and not exists (select 1 from journal_entry rv where rv.reverses_entry = j.id
                                                       and rv.occurred_at < v_end)), 0)), 0)
    into subledger
    from platform_order po join sales_order o on o.id = po.sales_order_id
   where po.business_id = p_business and o.placed_at < v_end and o.status <> 'open'
     and not exists (select 1 from sale_adjustment a where a.sales_order_id = o.id and a.kind = 'void'
                       and a.created_at < v_end);
  select coalesce(sum(o.net_amount - coalesce((select sum(a.amount) from sale_adjustment a
                                                where a.sales_order_id = o.id and a.kind = 'refund'
                                                  and a.created_at < v_end), 0)), 0)
    into v_unnumbered
    from sales_order o
   where o.business_id = p_business and o.placed_at < v_end and o.status <> 'open'
     and exists (select 1 from sales_tender t where t.sales_order_id = o.id and t.tender_type = 'platform_paid')
     and not exists (select 1 from platform_order po where po.sales_order_id = o.id)
     and not exists (select 1 from sale_adjustment a where a.sales_order_id = o.id and a.kind = 'void'
                       and a.created_at < v_end);
  select coalesce(sum(jl.debit - jl.credit), 0) into v_by_hand
    from journal_line jl join journal_entry e on e.id = jl.journal_entry_id join gl_account g on g.id = jl.account_id
   where e.business_id = p_business and e.status = 'published' and g.code = '1100' and e.occurred_at < v_end
     and e.reference_type is distinct from 'sales_order' and e.reference_type is distinct from 'sale_refund'
     and e.reference_type is distinct from 'platform_settlement'
     and not (e.reference_type = 'reversal'
              and exists (select 1 from journal_entry o where o.id = e.reverses_entry
                            and o.reference_type in ('sales_order', 'sale_refund', 'platform_settlement')));
  subledger := subledger + greatest(v_unnumbered + v_by_hand, 0);
  ledger := gl_balance_at(p_business, '1100', v_end);
  difference := subledger - ledger; return next;

  -- The drawers: what each should hold, from its counts and its cash since,
  -- against Cash in the till. Before a drawer is first counted in a session,
  -- the books are all there is (the first opening settles the difference, 0036).
  for l in select id from location where business_id = p_business loop
    d := drawer_position_at(p_business, l.id, v_end);
    if not d.known then v_known := false; end if;
    v_sum := v_sum + coalesce(d.amount, 0);
  end loop;
  -- Nothing to hold the books to until some drawer has been counted.
  if not exists (select 1 from work_shift w
                  where w.business_id = p_business
                    and ((w.kind = 'session' and w.opened_at < v_end) or (w.kind = 'drawer' and w.closed_at < v_end))) then
    v_known := false;
  end if;
  check_key := 'drawer';
  ledger := gl_balance_at(p_business, '1000', v_end);
  if v_known then
    label := 'What the drawers should hold vs Cash in the till (1000)';
    subledger := v_sum;
  else
    label := 'What the drawers should hold vs Cash in the till (1000): not yet counted, the first opening settles it';
    subledger := ledger;
  end if;
  difference := subledger - ledger; return next;

  -- The safe: cash moved in and out of it, expenses and bills paid from it,
  -- and dinars from dollars exchanged into it (0043), against the Safe (1005).
  check_key := 'safe'; label := 'Cash moved in and out of the safe vs Safe (1005)';
  select coalesce(sum(case when t.to_place = 'safe' then t.amount else -t.amount end), 0) into subledger
    from cash_transfer t join journal_entry j on j.id = t.journal_entry_id
   where t.business_id = p_business and 'safe' in (t.from_place, t.to_place) and j.occurred_at < v_end;
  subledger := subledger + coalesce((
    select sum(jl.debit - jl.credit)
      from journal_line jl join journal_entry e on e.id = jl.journal_entry_id join gl_account g on g.id = jl.account_id
     where e.business_id = p_business and e.status = 'published' and g.code = '1005' and e.occurred_at < v_end
       and (e.reference_type in ('expense', 'supplier_payment', 'fx_exchange')
            or (e.reference_type = 'reversal'
                and exists (select 1 from journal_entry o where o.id = e.reverses_entry
                              and o.reference_type in ('expense', 'supplier_payment'))))), 0);
  ledger := gl_balance_at(p_business, '1005', v_end);
  difference := subledger - ledger; return next;

  -- The dollars (0043): what the till and the safe hold, at what they were
  -- taken at, against Cash in dollars (1001 and 1006).
  check_key := 'dollars'; label := 'Dollars held, at what they were taken at, vs Cash in dollars (1001 and 1006)';
  select coalesce(sum(value), 0) into subledger
    from fx_cash_event where business_id = p_business and created_at < v_end;
  ledger := gl_balance_at(p_business, '1001', v_end) + gl_balance_at(p_business, '1006', v_end);
  difference := subledger - ledger; return next;

  -- The records themselves: how many lack their journal, or are journals
  -- lacking their record.
  check_key := 'documents'; label := 'Every record has its one journal, and every automatic journal its record';
  select count(*) into subledger from document_problems(p_business, v_end);
  ledger := 0;
  difference := subledger; return next;
end $$;

-- 0043's records to look into, with returns and credits.
create or replace function document_problems(p_business uuid, p_before timestamptz)
returns table (kind text, record_id uuid, at timestamptz, problem text)
language plpgsql stable set search_path = public as $$
declare v_start timestamptz;
begin
  select min(created_at) into v_start from journal_entry where business_id = p_business and not legacy;
  if v_start is null then return; end if;
  return query
  with j as (
    select e.id, e.reference_type, e.reference_id, e.reverses_entry, e.occurred_at, e.created_at
      from journal_entry e
     where e.business_id = p_business and e.status = 'published' and not e.legacy
  ),
  has as (select distinct reference_type, reference_id from j where reverses_entry is null and reference_id is not null)
  -- Records without their journal.
  select 'sale'::text, o.id, o.placed_at, 'A sale with no journal'::text
    from sales_order o
   where o.business_id = p_business and o.status <> 'open' and o.created_at >= v_start and o.placed_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'sales_order' and h.reference_id = o.id)
  union all
  select 'void', a.id, a.created_at, 'A void whose sale''s journal was not reversed'
    from sale_adjustment a
   where a.business_id = p_business and a.kind = 'void' and a.created_at >= v_start and a.created_at < p_before
     and not exists (select 1 from j s join j rv on rv.reverses_entry = s.id
                      where s.reference_type = 'sales_order' and s.reference_id = a.sales_order_id)
  union all
  select 'refund', a.id, a.created_at, 'A refund with no journal'
    from sale_adjustment a
   where a.business_id = p_business and a.kind = 'refund' and a.created_at >= v_start and a.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'sale_refund' and h.reference_id = a.id)
  union all
  select 'delivery', r.id, r.received_at, 'A delivery with no journal'
    from goods_receipt r
   where r.business_id = p_business and r.received_at >= v_start and r.received_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'goods_receipt' and h.reference_id = r.id)
  union all
  select 'correction', c.id, c.created_at, 'A delivery''s correction with no journal'
    from receipt_correction c
   where c.business_id = p_business and c.created_at < p_before and c.journal_entry_id is null
     and exists (select 1 from jsonb_array_elements(c.effects) e
                  where (e ->> 'stock_change')::numeric <> 0 or (e ->> 'grni_change')::numeric <> 0)
  union all
  select 'bill', b.id, b.created_at, 'A bill with no journal'
    from purchase_invoice b
   where b.business_id = p_business and not b.legacy and b.created_at >= v_start and b.created_at < p_before
     and b.journal_entry_id is null
     -- A bill for a delivery the old app posted to payables posts only a difference in price.
     and not (b.goods_receipt_id is not null and receipt_legacy_payable(b.goods_receipt_id) > 0)
  union all
  select 'payment', p.id, p.created_at, 'A payment with no journal'
    from supplier_payment p
   where p.business_id = p_business and p.created_at >= v_start and p.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'supplier_payment' and h.reference_id = p.id)
  union all
  select 'expense', x.id, x.created_at, 'An expense with no journal'
    from expense x
   where x.business_id = p_business and x.created_at >= v_start and x.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'expense' and h.reference_id = x.id)
  union all
  select 'stock', m.id, m.created_at, 'A loss, stock correction or opening stock with no journal'
    from inventory_movement m
   where m.business_id = p_business and m.created_at >= v_start and m.created_at < p_before and m.value > 0
     and m.type in ('waste', 'spoilage', 'melt_evaporation', 'staff_consumption', 'complimentary', 'sampling',
                    'damaged', 'expired', 'manual_correction', 'opening_balance')
     and m.reference_id is null
     and not exists (select 1 from has h where h.reference_type = 'inventory_movement' and h.reference_id = m.id)
  union all
  select 'count', c.id, c.approved_at, 'An approved count with no journal'
    from stock_count c
   where c.business_id = p_business and c.status = 'approved' and not c.legacy
     and c.approved_at >= v_start and c.approved_at < p_before
     and exists (select 1 from stock_count_line l join inventory_movement m on m.id = l.adjustment_movement_id
                  where l.stock_count_id = c.id and m.value > 0)
     and not exists (select 1 from has h where h.reference_type = 'stock_count' and h.reference_id = c.id)
  union all
  select 'cash', t.id, t.created_at, 'Cash moved with no journal'
    from cash_transfer t
   where t.business_id = p_business and t.created_at >= v_start and t.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'cash_transfer' and h.reference_id = t.id)
  union all
  select 'session', w.id, w.closed_at, 'A drawer counted over or short with no journal'
    from work_shift w
   where w.business_id = p_business and w.kind in ('session', 'drawer') and coalesce(w.variance, 0) <> 0
     and w.closed_at >= v_start and w.closed_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'work_shift' and h.reference_id = w.id)
  union all
  select 'session', w.id, w.opened_at, 'A drawer opened over or short with no journal'
    from work_shift w
   where w.business_id = p_business and w.kind = 'session' and coalesce(w.opening_variance, 0) <> 0
     and w.opened_at >= v_start and w.opened_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'session_opening' and h.reference_id = w.id)
  union all
  select 'session', c.work_shift_id, c.created_at, 'A drawer''s dollars counted with no journal'
    from session_dollar_count c
   where c.business_id = p_business and c.created_at >= v_start and c.created_at < p_before
     and (c.variance_value <> 0 or c.taken_value <> 0) and c.journal_entry_id is null
  union all
  select 'dollars', x.id, x.created_at, 'Dollars exchanged with no journal'
    from fx_exchange x
   where x.business_id = p_business and x.created_at >= v_start and x.created_at < p_before
     and x.journal_entry_id is null
  union all
  select 'return', x.id, x.created_at, 'A return to a supplier with no journal'
    from supplier_return x
   where x.business_id = p_business and x.created_at >= v_start and x.created_at < p_before
     and (x.value <> 0 or x.stock_value <> 0)
     and not exists (select 1 from has h where h.reference_type = 'supplier_return' and h.reference_id = x.id)
  union all
  select 'credit', c.id, c.created_at, 'A supplier''s credit with no journal'
    from supplier_credit c
   where c.business_id = p_business and c.kind <> 'goods_return' and c.created_at >= v_start and c.created_at < p_before
     and not exists (select 1 from has h where h.reference_type = 'supplier_credit' and h.reference_id = c.id)
  union all
  select 'card', s.id, s.created_at, 'A card settlement with no journal'
    from card_settlement s
   where s.business_id = p_business and s.created_at < p_before and s.journal_entry_id is null
  union all
  select 'platform', s.id, s.imported_at, 'A platform statement posted with no journal'
    from platform_settlement s
   where s.business_id = p_business and s.imported_at < p_before and s.journal_entry_id is null
     and exists (select 1 from platform_settlement_line l where l.settlement_id = s.id and l.status = 'matched')
  union all
  -- Automatic journals whose record does not exist (and that are not reversed).
  select 'journal', j.id, j.occurred_at,
         'A journal whose ' || case j.reference_type
           when 'sales_order' then 'sale' when 'goods_receipt' then 'delivery'
           when 'receipt_correction' then 'delivery correction' when 'purchase_invoice' then 'bill'
           when 'supplier_payment' then 'payment' when 'inventory_movement' then 'stock movement'
           when 'sale_refund' then 'refund' when 'cash_transfer' then 'cash movement'
           when 'work_shift' then 'drawer count' when 'session_opening' then 'drawer opening'
           when 'session_dollars' then 'drawer''s dollars count' when 'fx_exchange' then 'exchange of dollars'
           when 'supplier_return' then 'return to a supplier' when 'supplier_credit' then 'supplier''s credit'
           when 'platform_settlement' then 'platform statement'
           else replace(j.reference_type, '_', ' ') end || ' does not exist'
    from j
   where j.created_at < p_before and j.reverses_entry is null and j.reference_id is not null
     and not exists (select 1 from j rv where rv.reverses_entry = j.id and rv.created_at < p_before)
     and case j.reference_type
           when 'sales_order' then not exists (select 1 from sales_order x where x.id = j.reference_id)
           when 'goods_receipt' then not exists (select 1 from goods_receipt x where x.id = j.reference_id)
           when 'receipt_correction' then not exists (select 1 from receipt_correction x where x.id = j.reference_id)
           when 'purchase_invoice' then not exists (select 1 from purchase_invoice x where x.id = j.reference_id)
           when 'supplier_payment' then not exists (select 1 from supplier_payment x where x.id = j.reference_id)
           when 'expense' then not exists (select 1 from expense x where x.id = j.reference_id)
           when 'inventory_movement' then not exists (select 1 from inventory_movement x where x.id = j.reference_id)
           when 'stock_count' then not exists (select 1 from stock_count x where x.id = j.reference_id)
           when 'sale_refund' then not exists (select 1 from sale_adjustment x where x.id = j.reference_id)
           when 'cash_transfer' then not exists (select 1 from cash_transfer x where x.id = j.reference_id)
           when 'work_shift' then not exists (select 1 from work_shift x where x.id = j.reference_id)
           when 'session_opening' then not exists (select 1 from work_shift x where x.id = j.reference_id)
           when 'session_dollars' then not exists (select 1 from session_dollar_count x
                                                    where x.work_shift_id = j.reference_id)
           when 'fx_exchange' then not exists (select 1 from fx_exchange x where x.id = j.reference_id)
           when 'supplier_return' then not exists (select 1 from supplier_return x where x.id = j.reference_id)
           when 'supplier_credit' then not exists (select 1 from supplier_credit x where x.id = j.reference_id)
           when 'card_settlement' then not exists (select 1 from card_settlement x where x.id = j.reference_id)
           when 'platform_settlement' then not exists (select 1 from platform_settlement x where x.id = j.reference_id)
           else false end;
end $$;

-- 0043's hints, with returns and credits.
create or replace function journal_source_hint(p_ref_type text) returns text
language sql immutable as $$
  select case p_ref_type
    when 'sales_order' then 'a sale (void or refund it on Orders)'
    when 'sale_adjustment' then 'a refund'
    when 'sale_refund' then 'a refund (refund the rest of the sale on Orders if more should go back)'
    when 'goods_receipt' then 'a goods receipt (correct it on Purchasing)'
    when 'receipt_correction' then 'a delivery''s correction (correct the delivery again on Purchasing)'
    when 'purchase_invoice' then 'a bill (cancel it on Vendors)'
    when 'supplier_payment' then 'a supplier payment'
    when 'inventory_movement' then 'a stock record (correct stock with a count or a stock correction)'
    when 'stock_count' then 'a stock count (correct stock with a new count)'
    when 'work_shift' then 'a drawer count'
    when 'session_opening' then 'the opening count of a cash session'
    when 'session_dollars' then 'the dollars counted at a drawer''s close'
    when 'fx_exchange' then 'an exchange of dollars'
    when 'supplier_return' then 'a return to a supplier (record a credit on Vendors if more is owed back)'
    when 'supplier_credit' then 'a supplier''s credit'
    when 'cash_transfer' then 'a movement of cash (move it back instead)'
    when 'reversal' then 'a reversal (post the entry again instead)'
    when 'card_settlement' then 'a card settlement (cancel it on Sales)'
    when 'platform_settlement' then 'a platform settlement (cancel it on Delivery Platforms)'
    else 'a record of type ' || coalesce(p_ref_type, 'unknown') end
$$;

-- ---------------------------------------------------------------------------
-- 7. Who may call what
-- ---------------------------------------------------------------------------
revoke execute on function
  trg_po_line_draft(), rule_definitions(), rule_defaults(uuid), po_received(uuid), po_view(uuid), po_snapshot(uuid),
  po_lines_checked(uuid, jsonb), save_po__run(uuid, uuid, jsonb, date, text, uuid), approve_po__run(uuid),
  send_po__run(uuid), close_po__run(uuid, text), cancel_po__run(uuid, text),
  receive_goods__run(uuid, jsonb, numeric, numeric, numeric, text, uuid, boolean, uuid),
  trg_supplier_credit_guard(), trg_supplier_credit_allocation(), trg_purchase_invoice_guard(),
  cancel_bill__run(uuid, text, date), receipt_grni_value_at(uuid, timestamptz),
  return_to_supplier__run(uuid, jsonb, text, uuid, uuid, boolean),
  set_credit_against(uuid, uuid, uuid, numeric, uuid, boolean),
  record_supplier_credit__run(uuid, text, numeric, text, text, uuid, uuid, text),
  note_supplier_credit__run(uuid, text), allocate_credit__run(uuid, uuid, numeric),
  record_bill__run(uuid, text, date, numeric, int, uuid, text),
  correct_receipt__run(uuid, jsonb, uuid, date, text, boolean, boolean),
  reconciliation_checks(uuid, date), document_problems(uuid, timestamptz), journal_source_hint(text)
  from public, anon, authenticated;
revoke execute on function
  save_po(uuid, uuid, jsonb, date, text, uuid, uuid), approve_po(uuid, uuid), send_po(uuid, uuid),
  close_po(uuid, text, uuid), cancel_po(uuid, text, uuid), purchase_orders(), purchase_order(uuid),
  receive_goods(uuid, jsonb, numeric, numeric, numeric, text, uuid, boolean, uuid, uuid),
  return_to_supplier(uuid, jsonb, text, uuid, uuid, boolean, uuid),
  record_supplier_credit(uuid, text, numeric, text, text, uuid, uuid, text, uuid),
  note_supplier_credit(uuid, text, uuid), allocate_credit(uuid, uuid, numeric, uuid),
  supplier_statement(uuid, date, date), report_purchasing(date, date)
  from public, anon;
grant execute on function
  save_po(uuid, uuid, jsonb, date, text, uuid, uuid), approve_po(uuid, uuid), send_po(uuid, uuid),
  close_po(uuid, text, uuid), cancel_po(uuid, text, uuid), purchase_orders(), purchase_order(uuid),
  receive_goods(uuid, jsonb, numeric, numeric, numeric, text, uuid, boolean, uuid, uuid),
  return_to_supplier(uuid, jsonb, text, uuid, uuid, boolean, uuid),
  record_supplier_credit(uuid, text, numeric, text, text, uuid, uuid, text, uuid),
  note_supplier_credit(uuid, text, uuid), allocate_credit(uuid, uuid, numeric, uuid),
  supplier_statement(uuid, date, date), report_purchasing(date, date)
  to authenticated;
