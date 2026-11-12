-- 0101: the till that waits less for the internet (plan 8, step 4; plan 7,
-- item 12).
--
--   * A sale made offline may carry a discount, the seller's own (no more
--     than their cap: a manager cannot approve one with no internet), and the
--     customer chosen before the connection dropped (their points earned when
--     it arrives; no reward is taken offline). The database still checks
--     every one as it arrives.
--   * The till's key for what it keeps (`offline_key`): one for each café,
--     handed with the till to those who sell. What the till keeps on the
--     device is kept encrypted with it, so a device nobody is signed in on
--     shows nothing of it.
--   * Each till says what it still keeps (`note_till_kept`), and a manager is
--     told when one has kept sales half an hour or more (`till_kept` alert).
--
-- Nothing recorded changes.

-- -----------------------------------------------------------------------------
-- 1. A sale made offline, with its discount and its customer
-- -----------------------------------------------------------------------------
drop function if exists record_offline_sale(uuid, sales_channel, jsonb, timestamptz, tender_type, jsonb, uuid, numeric,
                                            text, uuid, text, numeric, boolean);
create function record_offline_sale(p_idempotency_key uuid, p_channel sales_channel, p_lines jsonb,
  p_sold_at timestamptz, p_tender tender_type default null, p_tenders jsonb default null,
  p_location uuid default null, p_expected_net numeric default null, p_platform_order_no text default null,
  p_sold_by uuid default null, p_device text default null, p_tip numeric default null,
  p_no_service boolean default false, p_discount_percent numeric default null,
  p_discount_amount numeric default null, p_discount_reason text default null, p_discount_note text default null,
  p_customer uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create'); r jsonb;
  v_me uuid := (current_member()).id; v_by uuid := v_me;
  v_no text := nullif(trim(p_platform_order_no), ''); v_platform uuid; v_pname text; v_active boolean;
  v_at timestamptz; v_replay boolean; v_order uuid;
  v_has_disc boolean := p_discount_percent is not null or p_discount_amount is not null;
  v_discount jsonb; v_check jsonb; v_pct numeric; v_cap numeric; v_customer jsonb;
begin
  perform sale_extras(p_tip, p_no_service);
  if p_idempotency_key is null then raise exception 'A sale needs its idempotency key'; end if;
  v_replay := exists (select 1 from sales_order where business_id = v_business and idempotency_key = p_idempotency_key);
  if not v_replay then
    if p_sold_at is null then raise exception 'Say when the sale was made'; end if;
    if p_sold_at > now() + interval '10 minutes' then
      raise exception 'This sale is dated later than now: check the till''s clock';
    end if;
    if p_sold_at < now() - interval '7 days' then
      raise exception 'This sale was made more than a week ago: a manager records it by hand';
    end if;
    if p_channel = 'direct_delivery' then
      raise exception 'A delivery by the café''s own driver needs the customer and their address';
    end if;
    if exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_tenders) = 'array' then p_tenders
                                                       else '[]'::jsonb end) x
                where x ->> 'currency' = 'USD') then
      raise exception 'A sale paid in dollars is not taken offline';
    end if;
    if is_platform_channel(p_channel) then
      select id, name, is_active into v_platform, v_pname, v_active
        from delivery_platform where business_id = v_business and code = p_channel::text;
      if v_platform is null then
        raise exception '% is not one of the café''s delivery platforms: add it on Delivery Platforms', initcap(p_channel::text);
      end if;
    end if;
    -- Who was signed in on the till when it was sold, if they may sell here.
    if p_sold_by is not null and p_sold_by <> v_me
       and exists (select 1 from app_user u where u.id = p_sold_by and u.business_id = v_business and u.is_active)
       and member_has_permission(p_sold_by, 'sale.create') then
      v_by := p_sold_by;
    end if;
    -- A discount offline is the seller's own: they may give one, and it is
    -- within their cap (checked once the sale is priced, below).
    if v_has_disc then
      if not member_has_permission(v_by, 'discount.apply') then
        raise exception 'You do not have permission to give discounts' using errcode = '42501';
      end if;
      v_discount := jsonb_build_object('checked', true, 'by', v_by, 'approved_by', null,
                                       'reason', reason_text('discount', p_discount_reason, p_discount_note));
    end if;
    -- The customer chosen before the connection dropped: no reward offline.
    if p_customer is not null then
      v_check := sale_customer_check(v_business, p_channel, p_customer, null, 0, v_has_disc, p_idempotency_key);
    end if;
    -- Its own time on the day it is sent; a later day's is recorded now.
    v_at := least(p_sold_at, now());
    if business_local_date(v_business, v_at) = business_local_date(v_business, now()) then
      perform set_config('sixties.sale_placed_at', v_at::text, true);
    end if;
    perform set_config('sixties.sale_offline', 'on', true);
    perform set_config('sixties.sale_sold_offline_at', p_sold_at::text, true);
    perform set_config('sixties.sale_device', coalesce(left(nullif(trim(p_device), ''), 64), ''), true);
  end if;
  r := post_sale(v_business, v_by, p_idempotency_key, p_channel, p_tender, p_lines,
                 p_location, p_discount_percent, p_discount_amount, false,
                 coalesce(v_discount, jsonb_build_object('reason', null, 'note', null, 'approval', null)),
                 p_tenders => p_tenders, p_expected_net => p_expected_net, p_customer => v_check);
  perform set_config('sixties.sale_placed_at', '', true);
  perform set_config('sixties.sale_offline', '', true);
  perform set_config('sixties.sale_sold_offline_at', '', true);
  perform set_config('sixties.sale_device', '', true);
  v_order := (r ->> 'order_id')::uuid;
  if coalesce((r ->> 'replayed')::boolean, false) then
    return r || jsonb_build_object('customer', sale_customer_answer(v_order),
      'platform_order_no', (select po.external_order_id from platform_order po where po.sales_order_id = v_order limit 1),
      'sold_offline_at', (select sold_offline_at from sales_order where id = v_order));
  end if;
  -- The discount within the seller's cap, as the till allowed it.
  if v_has_disc and not member_has_permission(v_by, 'discount.approve') then
    v_pct := discount_share((r ->> 'gross')::numeric - coalesce((r ->> 'deal_discount')::numeric, 0),
                            p_discount_percent, p_discount_amount);
    v_cap := member_rule_number(v_business, 'discount_cap_percent', v_by);
    if v_pct > v_cap then
      raise exception '%', format('A discount over %s%% needs a manager''s approval', trim_scale(v_cap));
    end if;
  end if;
  -- A platform's sale is matched to its payout by the order number (0030).
  if is_platform_channel(p_channel) then
    if v_no is null then
      raise exception 'Enter the % order number', v_pname;
    end if;
    if length(v_no) > 40 or v_no !~ '^[A-Za-z0-9#/_.-]+$' then
      raise exception 'An order number is letters and digits, as the % tablet shows it', v_pname;
    end if;
    if exists (select 1 from platform_order po
                where po.business_id = v_business and po.platform_id = v_platform
                  and lower(po.external_order_id) = lower(v_no)) then
      raise exception '% order % is already recorded', v_pname, v_no;
    end if;
    insert into platform_order (business_id, platform_id, location_id, external_order_id, status, store_list_value,
                                customer_payment, sales_order_id, placed_at, import_source)
    select v_business, v_platform, o.location_id, v_no, 'completed', o.gross_amount, o.net_amount, o.id, o.placed_at, 'till'
      from sales_order o where o.id = v_order;
    r := r || jsonb_build_object('platform_order_no', v_no);
  end if;
  v_customer := sale_customer_record(v_business, v_by, v_order, v_check);
  perform audit_event(v_business, 'sale.offline', 'sales_order', v_order::text, null, null,
    jsonb_build_object('sold_at', p_sold_at, 'sold_by', v_by, 'sent_by', v_me, 'device', p_device,
                       'net', r -> 'net', 'discount', case when v_has_disc then r -> 'discount' end,
                       'customer', p_customer));
  return r || jsonb_build_object('customer', v_customer, 'sold_offline_at', p_sold_at);
end $$;

-- -----------------------------------------------------------------------------
-- 2. The till's key for what it keeps on the device
-- -----------------------------------------------------------------------------
create table if not exists business_offline_key (
  business_id uuid primary key references business (id) on delete cascade,
  secret      bytea not null default extensions.gen_random_bytes(32),
  created_at  timestamptz not null default now()
);
alter table business_offline_key enable row level security;
alter table business_offline_key force row level security;
revoke all on business_offline_key from public, anon, authenticated;

create or replace function offline_key() returns text
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create');
begin
  insert into business_offline_key (business_id) values (v_business) on conflict (business_id) do nothing;
  return (select encode(secret, 'base64') from business_offline_key where business_id = v_business);
end $$;

-- -----------------------------------------------------------------------------
-- 3. What each till still keeps, and a manager told when it is long
-- -----------------------------------------------------------------------------
create table if not exists till_kept (
  business_id uuid not null references business (id) on delete cascade,
  till        text not null check (till ~ '^[A-Za-z0-9-]{8,64}$'),
  location_id uuid references location (id),
  app_user_id uuid references app_user (id),
  waiting     int not null default 0 check (waiting between 0 and 10000),
  attention   int not null default 0 check (attention between 0 and 10000),
  oldest_at   timestamptz,
  reported_at timestamptz not null default now(),
  primary key (business_id, till)
);
alter table till_kept enable row level security;
alter table till_kept force row level security;
revoke all on till_kept from public, anon, authenticated;

create or replace function note_till_kept(p_till text, p_location uuid, p_waiting int, p_attention int,
                                          p_oldest timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create');
begin
  if p_till is null or p_till !~ '^[A-Za-z0-9-]{8,64}$' then return; end if;
  if coalesce(p_waiting, 0) <= 0 and coalesce(p_attention, 0) <= 0 then
    delete from till_kept where business_id = v_business and till = p_till;
    return;
  end if;
  insert into till_kept (business_id, till, location_id, app_user_id, waiting, attention, oldest_at, reported_at)
  values (v_business, p_till,
          (select id from location where id = p_location and business_id = v_business),
          (current_member()).id, least(greatest(coalesce(p_waiting, 0), 0), 10000),
          least(greatest(coalesce(p_attention, 0), 0), 10000), least(p_oldest, now()), now())
  on conflict (business_id, till) do update
     set location_id = excluded.location_id, app_user_id = excluded.app_user_id, waiting = excluded.waiting,
         attention = excluded.attention, oldest_at = excluded.oldest_at, reported_at = excluded.reported_at;
end $$;

alter function alert_conditions(uuid, timestamptz) rename to alert_conditions_0100;
create or replace function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language sql stable set search_path = public as $$
  select c.rule, c.subject, c.urgency, c.title, c.why, c.action, c.confidence, c.link, c.facts
    from alert_conditions_0100(p_business, p_now) c
  union all
  -- A till that has kept sales not sent for half an hour or more, as it last said.
  select 'till_kept'::text, k.till, case when k.attention > 0 or k.oldest_at < p_now - interval '4 hours'
                                         then 'red' else 'orange' end,
         format('A till at %s keeps %s sales not yet sent', coalesce(l.name, '?'), k.waiting + k.attention),
         'Sales made while the internet was down wait on that till until they are sent: if it is not opened again, on the same browser, they are lost, and its cash is over in the count.',
         'Open the till there with the internet on, so it sends them; a sale waiting for a manager is sent by a manager on that till.',
         'high', '/pos', jsonb_build_object('waiting', k.waiting, 'attention', k.attention, 'oldest_at', k.oldest_at,
                                           'reported_at', k.reported_at)
    from till_kept k
    left join location l on l.id = k.location_id
   where k.business_id = p_business and k.oldest_at < p_now - interval '30 minutes'
     and k.reported_at > p_now - interval '2 days'
$$;

revoke execute on function alert_conditions(uuid, timestamptz), alert_conditions_0100(uuid, timestamptz)
  from public, anon, authenticated;
revoke execute on function record_offline_sale(uuid, sales_channel, jsonb, timestamptz, tender_type, jsonb, uuid, numeric,
                                               text, uuid, text, numeric, boolean, numeric, numeric, text, text, uuid),
  offline_key(), note_till_kept(text, uuid, int, int, timestamptz) from public, anon;
grant execute on function record_offline_sale(uuid, sales_channel, jsonb, timestamptz, tender_type, jsonb, uuid, numeric,
                                              text, uuid, text, numeric, boolean, numeric, numeric, text, text, uuid),
  offline_key(), note_till_kept(text, uuid, int, int, timestamptz) to authenticated;
