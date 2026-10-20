-- =============================================================================
-- 0082 — A bill on a table paid without internet (G1)
-- =============================================================================
-- 0073 let a till keep quick sales while the café's connection is down. A bill
-- on a table may now be paid the same way: the till keeps the payment, with
-- the bill's version as the till last had it, and sends it when the
-- connection is back.
--
--  * settle_tab_offline: 0050's settle_tab, for a payment taken offline. The
--    sale is dated when the money was taken (on the day it is sent), marked
--    sold offline, and not stopped for stock (the money was taken already),
--    exactly as record_offline_sale does for a quick sale. Sent twice, it is
--    paid once. If another till changed the bill meanwhile it is refused, as
--    settle_tab refuses it; if another till paid it, it is refused with that
--    said; either way it waits on the till for a manager.
--
-- Nothing recorded changes.
-- =============================================================================

create or replace function settle_tab_offline(p_tab uuid, p_version int, p_idempotency_key uuid,
  p_sold_at timestamptz, p_tenders jsonb, p_expected_net numeric default null, p_sold_by uuid default null,
  p_device text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create'); r jsonb; v_at timestamptz; v_order uuid; v_paid boolean;
begin
  if p_idempotency_key is null then raise exception 'A sale needs its idempotency key'; end if;
  select status = 'paid' into v_paid from pos_tab where id = p_tab and business_id = v_business;
  if v_paid is null then raise exception 'Bill not found'; end if;
  -- Paid already: by this payment (sent again: its answer), or on another till
  -- while this one was offline (the money was taken twice: a manager's to settle).
  if v_paid and (select o.idempotency_key from pos_tab t join sales_order o on o.id = t.sales_order_id
                  where t.id = p_tab) is distinct from p_idempotency_key then
    raise exception 'This bill was paid on another till while this one was offline: give back what was taken twice';
  end if;
  if not v_paid then
    if p_sold_at is null then raise exception 'Say when the sale was made'; end if;
    if p_sold_at > now() + interval '10 minutes' then
      raise exception 'This sale is dated later than now: check the till''s clock';
    end if;
    if p_sold_at < now() - interval '7 days' then
      raise exception 'This sale was made more than a week ago: a manager records it by hand';
    end if;
    if p_tenders is null or jsonb_typeof(p_tenders) <> 'array' or jsonb_array_length(p_tenders) = 0 then
      raise exception 'Choose how it was paid';
    end if;
    if exists (select 1 from jsonb_array_elements(p_tenders) x where x ->> 'currency' = 'USD') then
      raise exception 'A sale paid in dollars is not taken offline';
    end if;
    v_at := least(p_sold_at, now());
    if business_local_date(v_business, v_at) = business_local_date(v_business, now()) then
      perform set_config('sixties.sale_placed_at', v_at::text, true);
    end if;
    perform set_config('sixties.sale_offline', 'on', true);
    perform set_config('sixties.sale_sold_offline_at', p_sold_at::text, true);
    perform set_config('sixties.sale_device', coalesce(left(nullif(trim(p_device), ''), 64), ''), true);
  end if;
  r := settle_tab(p_tab, p_version, p_idempotency_key, null, p_expected_net, null, p_tenders);
  perform set_config('sixties.sale_placed_at', '', true);
  perform set_config('sixties.sale_offline', '', true);
  perform set_config('sixties.sale_sold_offline_at', '', true);
  perform set_config('sixties.sale_device', '', true);
  v_order := (r ->> 'order_id')::uuid;
  if not v_paid then
    perform audit_event(v_business, 'sale.offline', 'sales_order', v_order::text, null, null,
      jsonb_build_object('sold_at', p_sold_at, 'sold_by', p_sold_by, 'sent_by', (current_member()).id,
                         'device', p_device, 'net', r -> 'net', 'tab', p_tab));
  end if;
  return r || jsonb_build_object('sold_offline_at', (select sold_offline_at from sales_order where id = v_order));
end $$;

revoke execute on function settle_tab_offline(uuid, int, uuid, timestamptz, jsonb, numeric, uuid, text)
  from public, anon;
grant execute on function settle_tab_offline(uuid, int, uuid, timestamptz, jsonb, numeric, uuid, text)
  to authenticated;
