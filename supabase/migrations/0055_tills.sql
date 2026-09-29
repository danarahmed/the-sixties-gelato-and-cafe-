-- =============================================================================
-- 0055 — The tills at each branch, and who works where (release AB, second part)
--
-- 0054 sent stock between the café's places and let each device choose where
-- it does its stock work; the till still sold, and the drawer still counted,
-- at the first branch, and anyone could record anything anywhere
-- (docs/COMPLETION_PLAN.md, B12, D6 and release AB). Now:
--   * a person works everywhere, or at one of the café's places: every role
--     they hold is at that place. Nothing is recorded at a place by someone
--     who works at another: not a sale, a bill, a void or a refund, a drawer's
--     count, a delivery, a batch, a count, a loss, a transfer received or
--     cancelled, a table, a schedule or an hour clocked;
--   * only a branch sells: its bills, its tables, its drawer and its sessions,
--     the menu and its add-ons at its prices, and its own turn numbers, from 1
--     each day;
--   * a price can be the branch's own;
--   * an expense, a supplier's bill or a staff advance paid from the till comes
--     out of that branch's drawer;
--   * what a place sends to another is its demand in the day's plan and its
--     use in the buying list, and what is on its way to a place is coming.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Where a person works
-- ---------------------------------------------------------------------------
-- A person works everywhere (their roles have no place) or at one place (all
-- their roles are at it). The owner and the general manager work everywhere.
create or replace function trg_user_role_place() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.location_id is not null then
    if new.role in ('owner', 'general_manager') then
      raise exception 'The owner and the general manager work everywhere';
    end if;
    if not exists (select 1 from location l join app_user u on u.business_id = l.business_id
                    where l.id = new.location_id and u.id = new.app_user_id) then
      raise exception 'Choose one of the café''s places';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists user_role_place on user_role;
create trigger user_role_place before insert or update on user_role
  for each row execute function trg_user_role_place();

-- Checked as the transaction ends, so a person's roles move together.
create or replace function trg_user_role_one_place() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from user_role r where r.app_user_id = new.app_user_id
                and r.location_id is distinct from new.location_id) then
    raise exception 'A person works everywhere or at one place: all their roles are at that place';
  end if;
  return null;
end $$;
drop trigger if exists user_role_one_place on user_role;
create constraint trigger user_role_one_place after insert or update on user_role
  deferrable initially deferred
  for each row execute function trg_user_role_one_place();

-- The place a person works at: none when they work everywhere.
create or replace function member_place(p_member uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select r.location_id from user_role r where r.app_user_id = p_member
   order by r.location_id nulls first limit 1
$$;

-- The place the signed-in person works at: none when they work everywhere, or
-- when no one is signed in (the database's own jobs, SQL by hand).
create or replace function current_work_place() returns uuid
language sql stable security definer set search_path = public as $$
  select member_place(au.id) from app_user au where au.auth_user_id = auth.uid() and au.is_active limit 1
$$;

-- Nothing is recorded at a place by someone who works at another.
create or replace function assert_works_at(p_location uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_mine uuid;
begin
  if p_location is null or auth.uid() is null then return; end if;
  v_mine := current_work_place();
  if v_mine is not null and v_mine <> p_location then
    raise exception 'You work at %, not at %', (select name from location where id = v_mine),
      (select name from location where id = p_location) using errcode = '42501';
  end if;
end $$;

-- A row changed is checked at the place it was at, and at the place it is at.
create or replace function trg_works_here() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.location_id is distinct from new.location_id then
    perform assert_works_at(old.location_id);
  end if;
  perform assert_works_at(new.location_id);
  return new;
end $$;

-- On every table that records something at a place. What is derived from
-- these (a batch's lot, its movements) follows them; the drawers are the
-- places' own.
do $$
declare t text;
begin
  foreach t in array array['sales_order', 'pos_tab', 'dining_table', 'sale_refund', 'platform_order',
                           'work_shift', 'cash_event', 'cash_transfer', 'fx_cash_event', 'fx_exchange',
                           'session_dollar_count', 'inventory_movement', 'purchase_order', 'goods_receipt',
                           'supplier_return', 'production_batch', 'stock_count', 'stock_loss', 'expense',
                           'employee', 'shift_schedule', 'attendance', 'employee_advance', 'salary_payment']
  loop
    execute format('drop trigger if exists works_here on %I', t);
    execute format('create trigger works_here before insert or update on %I
                      for each row execute function trg_works_here()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. People: invited to a place, moved, and their roles changed where they are
-- ---------------------------------------------------------------------------
-- 0016's invite_member, with the place the person works at (none: everywhere).
drop function if exists invite_member(text, text, app_role[], uuid);
drop function if exists invite_member__run(text, text, app_role[]);
create or replace function invite_member__run(p_email text, p_name text, p_roles app_role[],
                                              p_location uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage'); v_id uuid; r app_role;
begin
  if nullif(trim(p_email), '') is null or nullif(trim(p_name), '') is null then
    raise exception 'Give the person''s name and email';
  end if;
  if p_roles is null or cardinality(p_roles) = 0 then raise exception 'Give the person at least one role'; end if;
  if ('owner' = any(p_roles) or 'general_manager' = any(p_roles)) and not current_has_role('owner') then
    raise exception 'Only the owner can appoint an owner or general manager' using errcode = '42501';
  end if;
  if p_location is not null
     and not exists (select 1 from location where id = p_location and business_id = v_business and is_active) then
    raise exception 'Choose one of the café''s places';
  end if;
  if exists (select 1 from app_user where business_id = v_business and lower(email::text) = lower(trim(p_email))) then
    raise exception 'Someone with that email is already a member';
  end if;
  insert into app_user (business_id, full_name, email) values (v_business, trim(p_name), lower(trim(p_email)))
  returning id into v_id;
  foreach r in array p_roles loop
    insert into user_role (app_user_id, role, location_id) values (v_id, r, p_location);
  end loop;
  -- Someone who created and confirmed their login before being added is linked
  -- now; the trigger on auth.users only sees confirmations after this.
  update app_user a set auth_user_id = u.id
    from auth.users u
   where a.id = v_id and lower(u.email) = lower(trim(p_email)) and u.email_confirmed_at is not null
     and not exists (select 1 from app_user o where o.auth_user_id = u.id);
  perform audit_event(v_business, 'member.invite', 'app_user', v_id::text, null, null,
                      jsonb_build_object('email', lower(trim(p_email)), 'roles', p_roles)
                      || case when p_location is not null
                              then jsonb_build_object('place', (select name from location where id = p_location))
                              else '{}'::jsonb end);
  return v_id;
end $$;

create or replace function invite_member(
  p_email text,
  p_name text,
  p_roles app_role[],
  p_location uuid default null,
  p_idempotency_key uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  -- The place is part of what was sent only when one was named, so a retry
  -- from before 0055 still matches.
  v_req jsonb := jsonb_build_object('p_email', p_email, 'p_name', p_name, 'p_roles', p_roles)
                 || case when p_location is not null then jsonb_build_object('p_location', p_location)
                         else '{}'::jsonb end;
  v jsonb;
  v_id uuid;
begin
  v := idem_begin(v_business, p_idempotency_key, 'invite_member', v_req);
  if v is not null then return (v #>> '{}')::uuid; end if;
  v_id := invite_member__run(p_email => p_email, p_name => p_name, p_roles => p_roles, p_location => p_location);
  perform idem_finish(v_business, p_idempotency_key, 'invite_member', v_req, to_jsonb(v_id));
  return v_id;
end $$;

-- 0016's set_member_roles: the person keeps the place they work at, but for
-- the owner and the general manager, who work everywhere.
create or replace function set_member_roles(p_member uuid, p_roles app_role[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_before app_role[];
  v_place uuid;
begin
  if p_roles is null or cardinality(p_roles) = 0 then raise exception 'Give the person at least one role'; end if;
  select coalesce(array_agg(role order by role), '{}') into v_before from user_role where app_user_id = p_member;
  if not exists (select 1 from app_user where id = p_member and business_id = v_business) then
    raise exception 'Member not found';
  end if;
  if (v_before && array['owner', 'general_manager']::app_role[] or p_roles && array['owner', 'general_manager']::app_role[])
     and not current_has_role('owner') then
    raise exception 'Only the owner can give or take the owner and general manager roles' using errcode = '42501';
  end if;
  if 'owner' = any(v_before) and not ('owner' = any(p_roles))
     and (select count(*) from user_role ur join app_user au on au.id = ur.app_user_id
           where au.business_id = v_business and au.is_active and ur.role = 'owner') <= 1 then
    raise exception 'The business must keep at least one active owner';
  end if;
  v_place := case when not (p_roles && array['owner', 'general_manager']::app_role[]) then member_place(p_member) end;
  delete from user_role where app_user_id = p_member;
  insert into user_role (app_user_id, role, location_id) select p_member, r, v_place from unnest(p_roles) r group by r;
  perform audit_event(v_business, 'member.roles', 'app_user', p_member::text, null,
                      jsonb_build_object('roles', v_before), jsonb_build_object('roles', p_roles));
end $$;

-- (settings.manage) Where a person works: one of the café's places in use,
-- or everywhere (none). The owner and the general manager work everywhere.
create or replace function set_member_place(p_member uuid, p_location uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_before uuid;
begin
  if not exists (select 1 from app_user where id = p_member and business_id = v_business) then
    raise exception 'Member not found';
  end if;
  if p_location is not null then
    if not exists (select 1 from location where id = p_location and business_id = v_business and is_active) then
      raise exception 'Choose one of the café''s places';
    end if;
    if exists (select 1 from user_role where app_user_id = p_member and role in ('owner', 'general_manager')) then
      raise exception 'The owner and the general manager work everywhere';
    end if;
  end if;
  v_before := member_place(p_member);
  if v_before is not distinct from p_location then return; end if;
  -- All their roles move at once.
  update user_role set location_id = p_location where app_user_id = p_member;
  perform audit_event(v_business, 'member.place', 'app_user', p_member::text, null,
    jsonb_build_object('place', coalesce((select name from location where id = v_before), 'everywhere')),
    jsonb_build_object('place', coalesce((select name from location where id = p_location), 'everywhere')));
end $$;

-- 0016's list_members, with where each person works.
drop function if exists list_members();
create or replace function list_members()
returns table (id uuid, full_name text, email text, roles app_role[], is_active boolean, linked boolean,
               works_at uuid, works_at_name text)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage');
begin
  return query
    select m.id, m.full_name, m.email::text,
           coalesce((select array_agg(ur.role order by ur.role) from user_role ur where ur.app_user_id = m.id),
                    '{}'::app_role[]),
           m.is_active, m.auth_user_id is not null, member_place(m.id),
           (select l.name from location l where l.id = member_place(m.id))
      from app_user m
     where m.business_id = v_business
     order by m.is_active desc, m.full_name;
end $$;

-- 0040's my_profile, with where the person works (none: everywhere).
create or replace function my_profile() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when m.id is null then null else jsonb_build_object(
    'id', m.id, 'name', m.full_name, 'business_id', m.business_id,
    'business_name', (select name from business where id = m.business_id),
    'timezone', (select timezone from business where id = m.business_id),
    'currency', (select currency_code from business where id = m.business_id),
    'currency_decimals', (select currency_decimals from business where id = m.business_id),
    'discount_round_to', rule_value(m.business_id, 'discount_round_to'),
    'discount_cap_percent', member_rule_number(m.business_id, 'discount_cap_percent', m.id),
    'refund_approval_over', member_rule_number(m.business_id, 'refund_approval_over', m.id),
    'waste_approval_over', member_rule_number(m.business_id, 'waste_approval_over', m.id),
    'waste_approval_window', rule_value(m.business_id, 'waste_approval_window'),
    'has_pin', m.pin_hash is not null,
    'roles', coalesce((select jsonb_agg(role order by role) from user_role where app_user_id = m.id), '[]'),
    'permissions', coalesce((select jsonb_agg(distinct rp.permission order by rp.permission)
                               from user_role ur join role_permission rp on rp.role = ur.role
                              where ur.app_user_id = m.id), '[]'),
    'works_at', member_place(m.id),
    'works_at_name', (select l.name from location l where l.id = member_place(m.id)))
  end
  from (select * from app_user where auth_user_id = auth.uid() and is_active limit 1) m
  right join (select 1) one on true
$$;

-- ---------------------------------------------------------------------------
-- 3. Only a branch sells
-- ---------------------------------------------------------------------------
-- A sale, a bill, a table and a cash session are a branch's: the central
-- kitchen and a warehouse keep stock, and sell nothing. What was recorded
-- before stays as it was.
create or replace function trg_sold_at_a_branch() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_kind location_kind; v_name text;
begin
  if tg_table_name = 'work_shift' then
    if new.kind <> 'session' then return new; end if;
  end if;
  select kind, name into v_kind, v_name from location where id = new.location_id;
  if v_kind is distinct from 'branch' then
    raise exception '% does not sell: the till is at a branch', v_name;
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['sales_order', 'pos_tab', 'dining_table', 'work_shift'] loop
    execute format('drop trigger if exists sold_at_a_branch on %I', t);
    execute format('create trigger sold_at_a_branch before insert on %I
                      for each row execute function trg_sold_at_a_branch()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. The till at its branch
-- ---------------------------------------------------------------------------
-- 0018's pos_catalogue, at the till's branch (none named: the first branch):
-- a branch's own price comes before the café's.
drop function if exists pos_catalogue();
create or replace function pos_catalogue(p_location uuid default null)
returns table (variant_id uuid, product_name text, variant_name text, category text, prices jsonb,
               product_id uuid, category_id uuid, category_sort int, image_url text, is_favourite boolean,
               name_ar text, name_ckb text, category_ar text, category_ckb text)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); v_today date; v_location uuid;
begin
  v_today := business_local_date(v_business, now());
  v_location := resolve_location(v_business, p_location);
  return query
    select pv.id, p.name, pv.name, pc.name,
           coalesce((select jsonb_object_agg(ch, price_on(pv.id, ch, v_location, v_today))
                       from unnest(enum_range(null::sales_channel)) ch
                      where price_on(pv.id, ch, v_location, v_today) is not null), '{}'),
           p.id, pc.id, pc.sort_order, p.image_url, p.is_favourite, p.name_ar, p.name_ckb, pc.name_ar, pc.name_ckb
      from product_variant pv
      join product p on p.id = pv.product_id
      left join product_category pc on pc.id = p.category_id
     -- A hidden category takes its products off the menu with it.
     where pv.business_id = v_business and pv.is_active and p.is_active and coalesce(pc.is_active, true)
     order by pc.sort_order nulls last, pc.name nulls last, p.name, pv.name;
end $$;

-- 0050's pos_open_bills, at the till's branch (none named: every branch's).
drop function if exists pos_open_bills();
create or replace function pos_open_bills(p_location uuid default null)
returns table (tab_id uuid, version integer, table_id uuid, table_name text, label text, channel sales_channel,
               business_day date, opened_at timestamptz, opened_by text, bill_printed_at timestamptz,
               bill_print_count integer, lines jsonb, total numeric, subtotal numeric, discount numeric,
               discount_percent numeric, discount_amount numeric, discount_reason text, discount_by text,
               discount_approved_by text, turn_no integer, customer_id uuid, customer_name text,
               customer_phone text, customer_points integer, customer_address_id uuid, delivery_address text)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); v_today date;
begin
  v_today := business_local_date(v_business, now());
  return query
    with l as (
      select tl.tab_id, tl.id, tl.position, tl.product_variant_id, tl.qty, tl.note, p.name as product_name,
             pv.name as variant_name,
             coalesce(tl.unit_price, price_on(tl.product_variant_id, t.channel, t.location_id, v_today)) as price,
             (select coalesce(jsonb_agg(jsonb_build_object(
                        'modifier_id', lm.modifier_id, 'name', md.name, 'name_ar', md.name_ar,
                        'name_ckb', md.name_ckb, 'qty', lm.qty,
                        'price', coalesce(lm.unit_price, modifier_price_on(lm.modifier_id, t.channel, t.location_id,
                                                                           v_today)))
                      order by lm.position, lm.id), '[]')
                from pos_tab_line_modifier lm join modifier md on md.id = lm.modifier_id
               where lm.tab_line_id = tl.id) as modifiers
        from pos_tab t
        join pos_tab_line tl on tl.tab_id = t.id
        join product_variant pv on pv.id = tl.product_variant_id
        join product p on p.id = pv.product_id
       where t.business_id = v_business and t.status = 'open'
         and (p_location is null or t.location_id = p_location)
    ),
    b as (
      select t.*,
             coalesce((select sum(money_round(v_business,
                                  (l.price + coalesce((select sum((a ->> 'price')::numeric * (a ->> 'qty')::numeric)
                                                         from jsonb_array_elements(l.modifiers) a), 0)) * l.qty))
                         from l where l.tab_id = t.id), 0) as gross
        from pos_tab t
       where t.business_id = v_business and t.status = 'open'
         and (p_location is null or t.location_id = p_location)
    )
    select b.id, b.version, b.table_id, dt.name, b.label, b.channel, b.business_day, b.opened_at, au.full_name,
           b.bill_printed_at, b.bill_print_count,
           coalesce((select jsonb_agg(jsonb_build_object(
                               'line_id', l.id, 'variant_id', l.product_variant_id, 'qty', l.qty, 'note', l.note,
                               'product_name', l.product_name, 'variant_name', l.variant_name, 'price', l.price,
                               'modifiers', l.modifiers)
                             order by l.position)
                       from l where l.tab_id = b.id), '[]'::jsonb),
           b.gross - sale_discount(v_business, b.gross, b.discount_percent, b.discount_amount),
           b.gross,
           sale_discount(v_business, b.gross, b.discount_percent, b.discount_amount),
           b.discount_percent, b.discount_amount,
           b.discount_reason, db.full_name, dab.full_name, b.turn_no,
           b.customer_id, cu.full_name, cu.phone, case when cu.id is not null then customer_points(cu.id) end,
           b.customer_address_id, b.delivery_address
      from b
      left join dining_table dt on dt.id = b.table_id
      left join app_user au on au.id = b.opened_by
      left join app_user db on db.id = b.discount_by
      left join app_user dab on dab.id = b.discount_approved_by
      left join customer cu on cu.id = b.customer_id
     order by b.opened_at;
end $$;

-- Each branch's own turn numbers, from 1 each day (0034's were the café's).
drop function if exists take_turn_no(uuid, date);
create or replace function take_turn_no(p_business uuid, p_day date, p_location uuid) returns int
language sql set search_path = public as $$
  select next_document_no(p_business, 'turn:' || p_location::text || ':' || p_day::text, 1)::int
$$;

-- The café's numbers so far were the first branch's: its counters go on from
-- where they are, so no number of today's is given twice.
insert into document_counter (business_id, doc_type, next_no)
select c.business_id, 'turn:' || default_location(c.business_id)::text || ':' || substr(c.doc_type, 6), c.next_no
  from document_counter c
 where c.doc_type ~ '^turn:\d{4}-\d{2}-\d{2}$' and default_location(c.business_id) is not null
on conflict (business_id, doc_type) do nothing;

-- 0034's trg_pos_tab_turn_no: a bill takes its branch's next number.
create or replace function trg_pos_tab_turn_no() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.turn_no is null then
    NEW.turn_no := take_turn_no(NEW.business_id, NEW.business_day, NEW.location_id);
  end if;
  return NEW;
end $$;

-- 0050's post_sale: a quick sale takes its branch's next number.
create or replace function post_sale(
  p_business uuid, p_me uuid, p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type,
  p_lines jsonb, p_location uuid, p_discount_percent numeric, p_discount_amount numeric,
  p_trust_line_prices boolean default false, p_discount jsonb default null, p_turn_no int default null,
  p_stock_approval uuid default null, p_tenders jsonb default null, p_expected_net numeric default null,
  p_customer jsonb default null)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_business uuid := p_business;
  v_me uuid := p_me;
  v_location uuid;
  v_order uuid;
  v_existing record;
  v_today date;
  v_needs jsonb; v_stock_by uuid;
  l jsonb; v_variant uuid; v_qty numeric; v_price numeric;
  v_variants uuid[] := '{}'; v_qtys numeric[] := '{}'; v_prices numeric[] := '{}'; v_gross_lines numeric[] := '{}';
  v_nets numeric[]; v_gross numeric := 0; v_discount numeric := 0; v_net numeric; v_cogs numeric := 0;
  d record; v_cost numeric; v_value numeric; v_line_cogs numeric; n int; i int;
  v_items uuid[];
  v_journal uuid;
  v_disc_by uuid; v_disc_approved uuid; v_disc_reason text; v_turn int; v_line uuid;
  v_mods jsonb[] := '{}'; v_mod jsonb; v_mod_costs numeric[]; v_amounts numeric[]; v_shares numeric[];
  v_part numeric; v_mod_cost numeric; j int; k int;
  v_pay jsonb; v_paid numeric;
begin
  if p_idempotency_key is null then
    raise exception 'A sale needs its idempotency key';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'The cart is empty';
  end if;
  v_pay := sale_payments(v_business, p_channel, p_tender, p_tenders);

  -- Replay: the same key returns the sale it already recorded.
  select id, gross_amount, discount_amount, net_amount, cogs_amount, turn_no into v_existing
    from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'gross', v_existing.gross_amount,
             'discount', v_existing.discount_amount, 'net', v_existing.net_amount, 'replayed', true,
             'turn_no', v_existing.turn_no, 'payments', order_payments(v_existing.id))
           || sale_cost_view(v_existing.cogs_amount);
  end if;

  if (p_discount_percent is not null or p_discount_amount is not null) and is_platform_channel(p_channel) then
    raise exception 'A delivery platform sets its own discounts; none is given at the till';
  end if;
  v_location := resolve_location(v_business, p_location);
  v_today := business_local_date(v_business, now());

  insert into sales_order (business_id, location_id, channel, status, idempotency_key,
                           gross_amount, discount_amount, net_amount, cogs_amount, cashier_id,
                           customer_id, customer_address_id, delivery_address)
  values (v_business, v_location, p_channel, 'open', p_idempotency_key, 0, 0, 0, 0, v_me,
          (p_customer ->> 'customer_id')::uuid, (p_customer ->> 'address_id')::uuid, p_customer ->> 'address')
  on conflict (business_id, idempotency_key) do nothing
  returning id into v_order;
  if v_order is null then
    -- A concurrent request with this key won the race; return its sale.
    select id, gross_amount, discount_amount, net_amount, cogs_amount, turn_no into v_existing
      from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
    return jsonb_build_object('order_id', v_existing.id, 'gross', v_existing.gross_amount,
             'discount', v_existing.discount_amount, 'net', v_existing.net_amount, 'replayed', true,
             'turn_no', v_existing.turn_no, 'payments', order_payments(v_existing.id))
           || sale_cost_view(v_existing.cogs_amount);
  end if;

  -- Each line: a product on sale, a quantity, and its add-ons as the product
  -- offers them, priced (0041).
  for l in select * from jsonb_array_elements(p_lines) loop
    v_variant := (l ->> 'variant_id')::uuid;
    v_qty := (l ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Each line needs a positive quantity'; end if;
    if not exists (select 1 from product_variant pv join product p on p.id = pv.product_id
                    where pv.id = v_variant and pv.business_id = v_business and pv.is_active and p.is_active) then
      raise exception 'That product is not on sale';
    end if;
    v_variants := v_variants || v_variant;
    v_qtys := v_qtys || v_qty;
    v_mods := array_append(v_mods, line_modifiers(v_business, v_variant, l -> 'modifiers', p_channel, v_location,
                                                  v_today, p_trust_line_prices));
  end loop;
  n := cardinality(v_variants);

  -- What the sale uses, its add-ons' included: locked in a stable order, then
  -- sold as each item's rule says (0040): refused, sold with a manager's
  -- approval, or sold and shown as an alert.
  select jsonb_agg(jsonb_build_object('item_id', u.item_id, 'qty', u.base_qty)) into v_needs
    from (select e.item_id, e.base_qty
            from generate_series(1, n) s(ix), lateral expand_variant(v_variants[s.ix], p_channel, v_qtys[s.ix], v_today) e
          union all
          select e.item_id, e.base_qty
            from generate_series(1, n) s(ix), lateral jsonb_array_elements(v_mods[s.ix]) a(m),
                 lateral expand_modifier((a.m ->> 'modifier_id')::uuid, v_variants[s.ix], p_channel,
                                         v_qtys[s.ix] * (a.m ->> 'qty')::numeric) e) u;
  select array_agg(distinct (x ->> 'item_id')::uuid) into v_items from jsonb_array_elements(v_needs) x;
  if v_items is not null then
    perform lock_items(v_items);
    v_stock_by := stock_rules(v_business, v_location, v_needs, v_me, p_stock_approval, 'negative_stock',
                              v_order::text);
  end if;

  -- Price every line first: its size and its add-ons, each one of the line;
  -- the discount is shared out over the whole bill.
  for i in 1 .. n loop
    l := p_lines -> (i - 1);
    -- A bill's printed price, passed by settle_tab alone (0025); otherwise today's.
    v_price := case when p_trust_line_prices and nullif(l ->> 'price', '') is not null
                    then (l ->> 'price')::numeric
                    else price_on(v_variants[i], p_channel, v_location, v_today) end;
    if v_price is null then
      raise exception 'No % price is set for this product', p_channel;
    end if;
    v_price := v_price + coalesce((select sum((x ->> 'price')::numeric * (x ->> 'qty')::numeric)
                                     from jsonb_array_elements(v_mods[i]) x), 0);
    v_prices := v_prices || v_price;
    v_gross_lines := v_gross_lines || money_round(v_business, v_price * v_qtys[i]);
    v_gross := v_gross + money_round(v_business, v_price * v_qtys[i]);
  end loop;

  -- Each line's share of the discount, in proportion to its value, adding up
  -- to the discount exactly (the rounding method receipts use for landed costs).
  v_discount := sale_discount(v_business, v_gross, p_discount_percent, p_discount_amount);
  if v_discount > 0 then
    v_nets := allocate_landed(v_business, v_gross_lines, -v_discount);
    -- Who gave it, why, and who approved it (0028).
    if coalesce((p_discount ->> 'checked')::boolean, false) then
      v_disc_by := (p_discount ->> 'by')::uuid;
      v_disc_approved := (p_discount ->> 'approved_by')::uuid;
      v_disc_reason := p_discount ->> 'reason';
    else
      v_disc_reason := reason_text('discount', p_discount ->> 'reason', p_discount ->> 'note');
      v_disc_by := v_me;
      v_disc_approved := discount_approver(v_business, v_gross, p_discount_percent, p_discount_amount,
                                           (p_discount ->> 'approval')::uuid, v_order::text);
    end if;
  else
    v_nets := v_gross_lines;
  end if;
  v_net := v_gross - v_discount;

  -- The total the till showed (0025), then the payments: together they come to
  -- the net exactly (0042). The old single tender pays all of it.
  perform assert_sale_total(jsonb_build_object('net', v_net), p_expected_net);
  select jsonb_agg(case when jsonb_typeof(x -> 'amount') = 'null' then x || jsonb_build_object('amount', v_net)
                        else x end order by o)
    into v_pay from jsonb_array_elements(v_pay) with ordinality e(x, o);
  select sum((x ->> 'amount')::numeric) into v_paid from jsonb_array_elements(v_pay) x;
  if v_paid <> v_net then
    raise exception 'The payments come to %, not the % to pay', trim_scale(v_paid), trim_scale(v_net);
  end if;
  -- Dollars at the rate now, worth at least what they pay (0043).
  v_pay := sale_dollars(v_business, v_pay);

  for i in 1 .. n loop
    -- One costed movement per component per line, and per add-on, so every
    -- figure ties: line COGS = its movements; order COGS = all movements =
    -- the journal. Cost first, then write the line once: lines are
    -- append-only. Each movement names its line (0037), so a refund of the
    -- line takes back its own stock, its add-ons' included.
    v_line := gen_random_uuid();
    v_line_cogs := 0;
    for d in select * from expand_variant(v_variants[i], p_channel, v_qtys[i], v_today) loop
      v_cost := item_issue_cost(v_business, d.item_id, v_location);
      v_value := money_round(v_business, v_cost * d.base_qty);
      insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                      unit_cost, value, reference_type, reference_id, app_user_id, reason,
                                      sales_order_line_id)
      values (v_business, d.item_id, v_location, 'sale_consumption', -d.base_qty,
              case when d.base_qty > 0 then v_value / d.base_qty end, v_value,
              'sales_order', v_order, v_me, 'Sale', v_line);
      v_line_cogs := v_line_cogs + v_value;
    end loop;
    v_mod_costs := '{}';
    v_amounts := '{}';
    k := coalesce(jsonb_array_length(v_mods[i]), 0);
    for j in 1 .. k loop
      v_mod := v_mods[i] -> (j - 1);
      v_mod_cost := 0;
      for d in select * from expand_modifier((v_mod ->> 'modifier_id')::uuid, v_variants[i], p_channel,
                                             v_qtys[i] * (v_mod ->> 'qty')::numeric) loop
        v_cost := item_issue_cost(v_business, d.item_id, v_location);
        v_value := money_round(v_business, v_cost * d.base_qty);
        insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed,
                                        unit_cost, value, reference_type, reference_id, app_user_id, reason,
                                        sales_order_line_id)
        values (v_business, d.item_id, v_location, 'sale_consumption', -d.base_qty,
                case when d.base_qty > 0 then v_value / d.base_qty end, v_value,
                'sales_order', v_order, v_me, 'Sale: ' || (v_mod ->> 'name'), v_line);
        v_mod_cost := v_mod_cost + v_value;
      end loop;
      v_mod_costs := v_mod_costs || v_mod_cost;
      v_line_cogs := v_line_cogs + v_mod_cost;
      v_amounts := v_amounts || money_round(v_business, (v_mod ->> 'price')::numeric * (v_mod ->> 'qty')::numeric
                                                        * v_qtys[i]);
    end loop;

    insert into sales_order_line (id, sales_order_id, product_variant_id, quantity, unit_price, line_discount, line_net,
                                  cogs_amount)
    values (v_line, v_order, v_variants[i], v_qtys[i], v_prices[i], v_gross_lines[i] - v_nets[i], v_nets[i],
            v_line_cogs);
    v_cogs := v_cogs + v_line_cogs;

    -- The add-ons as they were sold: each its amount and its share of the
    -- line's discount, the size keeping the rest.
    if k > 0 then
      v_part := v_gross_lines[i] - (select coalesce(sum(a), 0) from unnest(v_amounts) a);
      if v_nets[i] < v_gross_lines[i] then
        v_shares := allocate_landed(v_business, array[v_part] || v_amounts, v_nets[i] - v_gross_lines[i]);
      else
        v_shares := array[v_part] || v_amounts;
      end if;
      for j in 1 .. k loop
        v_mod := v_mods[i] -> (j - 1);
        insert into sales_order_line_modifier (business_id, sales_order_id, sales_order_line_id, modifier_id, group_id,
                                               name, qty, unit_price, amount, net_amount, cost, position)
        values (v_business, v_order, v_line, (v_mod ->> 'modifier_id')::uuid, (v_mod ->> 'group_id')::uuid,
                v_mod ->> 'name', (v_mod ->> 'qty')::numeric * v_qtys[i], (v_mod ->> 'price')::numeric,
                v_amounts[j], v_shares[j + 1], v_mod_costs[j], j);
      end loop;
    end if;
  end loop;

  -- Each payment in its order; a cash one is also the drawer's, a payment in
  -- dollars the dollars' (trg_cash_from_tender).
  insert into sales_tender (sales_order_id, tender_type, amount, received, position, currency, foreign_amount, rate)
  select v_order, (x ->> 'type')::tender_type, (x ->> 'amount')::numeric, (x ->> 'received')::numeric, o,
         coalesce(x ->> 'currency', 'IQD'), (x ->> 'usd')::numeric, (x ->> 'rate')::numeric
    from jsonb_array_elements(v_pay) with ordinality e(x, o)
   order by o;

  -- Its turn number (0034): the bill's own, or the next of the day. Taken in
  -- the sale's own transaction, so a sale refused takes none.
  v_turn := coalesce(p_turn_no, take_turn_no(v_business, v_today, v_location));
  update sales_order
     set gross_amount = v_gross, discount_amount = v_discount, net_amount = v_net, cogs_amount = v_cogs,
         discount_percent = case when v_discount > 0 then p_discount_percent end,
         discount_by = v_disc_by, discount_approved_by = v_disc_approved, discount_reason = v_disc_reason,
         status = 'completed', turn_no = v_turn
   where id = v_order;

  -- Each payment's account debited with what it paid (one line per account),
  -- revenue at the full price, the discount on its own line (none posts when
  -- it is zero). Dollars are debited to 1001 at their value, and their change
  -- in dinars leaves 1000 (0043).
  v_journal := post_journal(v_business, now(), 'Sale ' || left(v_order::text, 8), 'sales_order', v_order,
    coalesce((select jsonb_agg(signed_line(a.code, a.amount) order by a.pos)
                from (select p.code, sum(p.amount) as amount, min(p.pos) as pos
                        from jsonb_array_elements(v_pay) with ordinality e(x, o)
                        cross join lateral (
                          select tender_account((x ->> 'type')::tender_type) as code,
                                 case when x ->> 'currency' = 'USD'
                                      then (x ->> 'amount')::numeric - (x ->> 'received')::numeric
                                      else (x ->> 'amount')::numeric end as amount, o as pos
                          union all
                          select '1001', (x ->> 'received')::numeric, o where x ->> 'currency' = 'USD') p
                       group by p.code) a), '[]'::jsonb)
    || jsonb_build_array(
      jsonb_build_object('code', '4100', 'debit', v_discount),
      jsonb_build_object('code', '4000', 'credit', v_gross),
      jsonb_build_object('code', '5000', 'debit', v_cogs),
      jsonb_build_object('code', '1200', 'credit', v_cogs)));

  if v_discount > 0 then
    perform audit_event(v_business, 'sale.discount', 'sales_order', v_order::text, v_disc_reason, null,
      jsonb_build_object('gross', v_gross, 'discount', v_discount, 'percent', p_discount_percent,
                         'amount', p_discount_amount, 'given_by', v_disc_by, 'approved_by', v_disc_approved));
  end if;

  return jsonb_build_object('order_id', v_order, 'gross', v_gross, 'discount', v_discount, 'net', v_net,
    'journal_no', (select journal_no from journal_entry where id = v_journal), 'replayed', false,
    'turn_no', v_turn, 'payments', order_payments(v_order))
    || sale_cost_view(v_cogs);
end $$;

-- 0048's write_loss: a giveaway at the till takes its branch's next number.
create or replace function write_loss(p_business uuid, p_me uuid, p_location uuid, p_kind movement_type,
                                      p_lines jsonb, p_reason text, p_approval uuid, p_wait boolean,
                                      p_at_till boolean, p_channel sales_channel default 'dine_in')
returns jsonb language plpgsql set search_path = public as $$
declare
  v_loss uuid := gen_random_uuid(); v_today date := business_local_date(p_business, now());
  v_channel sales_channel := coalesce(p_channel, 'dine_in');
  l jsonb; n int := 0; v_item uuid; v_variant uuid; v_qty numeric; v_base numeric; v_lot item_lot;
  v_mods jsonb; v_kept jsonb := '[]'; v_parts jsonb := '[]'; v_moves jsonb := '[]'; v_line_values jsonb; p jsonb;
  v_cost numeric; v_value numeric; v_total numeric := 0; v_status approval_status; v_approver uuid;
  v_journal uuid; v_first uuid; v_mv uuid; v_turn int; v_name text; v_unit text; v_top int; v_gap numeric;
begin
  if p_kind is null or not is_loss(p_kind) then raise exception 'Choose what kind of loss it is'; end if;
  if p_at_till and not is_giveaway(p_kind) then
    raise exception 'At the till, a staff meal, on the house or a sample is given away';
  end if;
  if nullif(trim(p_reason), '') is null then
    if p_at_till then raise exception 'Say why it is given away'; end if;
    raise exception 'Say why the stock was lost';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    if p_at_till then raise exception 'The cart is empty'; end if;
    raise exception 'Choose what was lost';
  end if;
  if jsonb_array_length(p_lines) > 50 then raise exception 'At most 50 lines at once'; end if;

  -- What each line takes out, item by item.
  for l in select * from jsonb_array_elements(p_lines) loop
    n := n + 1;
    v_item := nullif(l ->> 'item_id', '')::uuid;
    v_variant := nullif(l ->> 'variant_id', '')::uuid;
    v_qty := (l ->> 'qty')::numeric;
    v_mods := '[]';
    if (v_item is null) = (v_variant is null) then raise exception 'Choose an item or a product that was lost'; end if;
    if v_item is not null then
      if p_at_till then raise exception 'At the till, products are given away'; end if;
      if not exists (select 1 from item where id = v_item and business_id = p_business) then
        raise exception 'Unknown item';
      end if;
      if v_qty is null or v_qty <= 0 then raise exception 'Enter a quantity greater than zero'; end if;
      v_base := to_base_qty(v_item, v_qty, nullif(l ->> 'unit_code', ''));
      if v_base is null or v_base <= 0 then raise exception 'Enter a quantity greater than zero'; end if;
      if nullif(l ->> 'lot_id', '') is not null then
        select * into v_lot from item_lot where id = (l ->> 'lot_id')::uuid and business_id = p_business;
        if not found or v_lot.item_id <> v_item or v_lot.location_id is distinct from p_location then
          raise exception 'That batch is not of this item, here';
        end if;
      end if;
      v_parts := v_parts || jsonb_build_object('line', n, 'item_id', v_item, 'qty', v_base,
                                               'lot_id', nullif(l ->> 'lot_id', ''));
    else
      if nullif(l ->> 'lot_id', '') is not null then raise exception 'A batch is named for an item, not a product'; end if;
      if v_qty is null or v_qty <= 0 then raise exception 'Enter a quantity greater than zero'; end if;
      select pr.name into v_name from product_variant pv join product pr on pr.id = pv.product_id
       where pv.id = v_variant and pv.business_id = p_business and pv.is_active and pr.is_active;
      if not found then raise exception 'That product is not on sale'; end if;
      -- At the till, its add-ons as the product offers them (0041).
      if p_at_till then
        v_mods := coalesce(line_modifiers(p_business, v_variant, l -> 'modifiers', v_channel, p_location, v_today),
                           '[]');
      end if;
      select coalesce(jsonb_agg(jsonb_build_object('line', n, 'item_id', u.item_id, 'qty', u.qty, 'lot_id', null)),
                      '[]')
        into p
        from (select e.item_id, sum(e.base_qty) as qty
                from (select x.item_id, x.base_qty from expand_variant(v_variant, v_channel, v_qty, v_today) x
                      union all
                      select x.item_id, x.base_qty
                        from jsonb_array_elements(v_mods) a(m),
                             lateral expand_modifier((a.m ->> 'modifier_id')::uuid, v_variant, v_channel,
                                                     v_qty * (a.m ->> 'qty')::numeric) x) e
               group by e.item_id having sum(e.base_qty) > 0) u;
      -- On Inventory, a product that uses no stock loses nothing; at the till it
      -- is given away with the rest (a glass of water), costing nothing.
      if jsonb_array_length(p) = 0 and not p_at_till then
        raise exception '% uses no stock: nothing is lost with it', v_name;
      end if;
      v_parts := v_parts || p;
    end if;
    v_kept := v_kept || jsonb_build_object('line', n, 'item_id', v_item, 'variant_id', v_variant, 'qty', v_qty,
                                           'unit_code', case when v_item is not null then nullif(l ->> 'unit_code', '') end,
                                           'lot_id', nullif(l ->> 'lot_id', ''), 'modifiers', v_mods);
  end loop;
  if jsonb_array_length(v_parts) = 0 then
    raise exception 'Nothing given uses any stock: there is nothing to record';
  end if;

  -- Its items locked in a stable order; a batch named holds enough.
  perform lock_items(array(select distinct (x ->> 'item_id')::uuid from jsonb_array_elements(v_parts) x));
  for p in select x from jsonb_array_elements(v_parts) x where x ->> 'lot_id' is not null loop
    select * into v_lot from item_lot where id = (p ->> 'lot_id')::uuid;
    if v_lot.left_base < (p ->> 'qty')::numeric then
      select base_unit_code into v_unit from item where id = v_lot.item_id;
      raise exception '%', format('Only %s %s of batch %s is left', trim_scale(greatest(v_lot.left_base, 0)), v_unit,
                                  coalesce((select b.batch_no::text from production_batch b
                                             where b.id = v_lot.production_batch_id), v_lot.lot_code));
    end if;
  end loop;
  -- One movement for each item (and batch named), at what it costs now,
  -- rounded once; the lines' shares add up to the whole.
  for p in
    select jsonb_build_object('item_id', x ->> 'item_id', 'lot_id', x ->> 'lot_id', 'qty', sum((x ->> 'qty')::numeric))
      from jsonb_array_elements(v_parts) x
     group by x ->> 'item_id', x ->> 'lot_id'
     order by min((x ->> 'line')::int), x ->> 'item_id', x ->> 'lot_id'
  loop
    v_cost := item_issue_cost(p_business, (p ->> 'item_id')::uuid, p_location);
    v_value := money_round(p_business, v_cost * (p ->> 'qty')::numeric);
    v_moves := v_moves || (p || jsonb_build_object('cost', v_cost, 'value', v_value));
    v_total := v_total + v_value;
  end loop;
  select coalesce(jsonb_object_agg(y.line::text, y.val), '{}') into v_line_values
    from (select (x ->> 'line')::int as line,
                 money_round(p_business, sum((x ->> 'qty')::numeric
                   * (select (mv ->> 'cost')::numeric from jsonb_array_elements(v_moves) mv
                       where mv ->> 'item_id' = x ->> 'item_id' limit 1))) as val
            from jsonb_array_elements(v_parts) x group by 1) y;
  select v_total - coalesce(sum((e.value)::numeric), 0) into v_gap from jsonb_each_text(v_line_values) e;
  if v_gap <> 0 then
    select (e.key)::int into v_top from jsonb_each_text(v_line_values) e
     order by (e.value)::numeric desc, (e.key)::int limit 1;
    v_line_values := jsonb_set(v_line_values, array[v_top::text],
                               to_jsonb((v_line_values ->> v_top::text)::numeric + v_gap));
  end if;
  select a.status, a.approver into v_status, v_approver
    from loss_approval(p_business, p_me, p_location, v_moves, p_approval, p_wait, v_loss::text) a;
  if p_at_till then v_turn := take_turn_no(p_business, v_today, p_location); end if;

  if v_total > 0 then
    v_journal := post_journal(p_business, now(),
      initcap(replace(p_kind::text, '_', ' ')) || ': ' || trim(p_reason), 'stock_loss', v_loss,
      jsonb_build_array(jsonb_build_object('code', loss_account(p_kind), 'debit', v_total),
                        jsonb_build_object('code', '1200', 'credit', v_total)));
  end if;
  insert into stock_loss (id, business_id, location_id, kind, reason, value, status, approved_by, recorded_by,
                          at_till, channel, turn_no, journal_entry_id)
  values (v_loss, p_business, p_location, p_kind, trim(p_reason), v_total, v_status, v_approver, p_me,
          coalesce(p_at_till, false), case when p_at_till then v_channel end, v_turn, v_journal);
  insert into stock_loss_line (stock_loss_id, business_id, item_id, product_variant_id, qty, unit_code, lot_id,
                               modifiers, value, position)
  select v_loss, p_business, (k ->> 'item_id')::uuid, (k ->> 'variant_id')::uuid, (k ->> 'qty')::numeric,
         k ->> 'unit_code', (k ->> 'lot_id')::uuid, k -> 'modifiers',
         coalesce((v_line_values ->> (k ->> 'line'))::numeric, 0), (k ->> 'line')::int
    from jsonb_array_elements(v_kept) k;
  for p in select * from jsonb_array_elements(v_moves) loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason, approval_status, lot_id)
    values (p_business, (p ->> 'item_id')::uuid, p_location, p_kind, -(p ->> 'qty')::numeric,
            (p ->> 'cost')::numeric, (p ->> 'value')::numeric, 'stock_loss', v_loss, p_me, trim(p_reason), v_status,
            (p ->> 'lot_id')::uuid)
    returning id into v_mv;
    v_first := coalesce(v_first, v_mv);
  end loop;
  -- The manager who approved it with their PIN is kept with each of its movements.
  if v_approver is not null and v_approver is distinct from p_me then
    insert into loss_review (business_id, movement_id, decision, decided_by)
    select p_business, m.id, 'approved', v_approver from inventory_movement m
     where m.reference_type = 'stock_loss' and m.reference_id = v_loss;
  end if;
  return jsonb_build_object('loss_id', v_loss, 'movement_id', v_first, 'status', v_status, 'approver_id', v_approver,
    'approved_by', (select full_name from app_user where id = v_approver), 'turn_no', v_turn,
    'journal_no', (select journal_no from journal_entry where id = v_journal))
    || case when current_has_permission('cost.view') then jsonb_build_object('value', v_total) else '{}' end;
end $$;

-- ---------------------------------------------------------------------------
-- 5. A branch's own prices
-- ---------------------------------------------------------------------------
-- 0027's set_price, for every branch (none named) or for one: a branch's own
-- price comes before the café's there, from its day, as price_on has always
-- read it.
drop function if exists set_price(uuid, sales_channel, numeric, date, uuid);
drop function if exists set_price__run(uuid, sales_channel, numeric, date);
create or replace function set_price__run(p_variant uuid, p_channel sales_channel, p_price numeric,
                                          p_effective_from date default null, p_location uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('recipe.edit'); v_today date; v_from date;
begin
  if not exists (select 1 from product_variant where id = p_variant and business_id = v_business) then
    raise exception 'Unknown product';
  end if;
  if p_price is null or p_price < 0 then raise exception 'Enter a price'; end if;
  if p_location is not null and not exists (select 1 from location where id = p_location
                                               and business_id = v_business and is_active and kind = 'branch') then
    raise exception 'Choose one of the café''s branches';
  end if;
  v_today := business_local_date(v_business, now());
  v_from := coalesce(p_effective_from, v_today);
  if v_from < v_today then
    raise exception 'A price cannot start in the past: every sale keeps the price it was made at';
  end if;
  insert into channel_price (business_id, product_variant_id, channel, price, effective_from, location_id)
  values (v_business, p_variant, p_channel, p_price, v_from, p_location);
end $$;

create or replace function set_price(
  p_variant uuid,
  p_channel sales_channel,
  p_price numeric,
  p_effective_from date default null,
  p_location uuid default null,
  p_idempotency_key uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  -- The branch is part of what was sent only when one was named, so a retry
  -- from before 0055 still matches.
  v_req jsonb := jsonb_build_object('p_variant', p_variant, 'p_channel', p_channel, 'p_price', p_price,
                                    'p_effective_from', p_effective_from)
                 || case when p_location is not null then jsonb_build_object('p_location', p_location)
                         else '{}'::jsonb end;
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_price', v_req);
  if v is not null then return; end if;
  perform set_price__run(p_variant => p_variant, p_channel => p_channel, p_price => p_price,
                         p_effective_from => p_effective_from, p_location => p_location);
  perform idem_finish(v_business, p_idempotency_key, 'set_price', v_req, 'null'::jsonb);
end $$;

-- 0027's audit_price_change: a branch's price names its branch.
create or replace function audit_price_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_was numeric; v_reason text := nullif(current_setting('audit.reason', true), '');
  v_old jsonb; v_new jsonb; v_before jsonb := '{}'; v_after jsonb := '{}'; k text;
begin
  if tg_op = 'INSERT' then
    select cp.price into v_was from channel_price cp
     where cp.product_variant_id = new.product_variant_id and cp.channel = new.channel and cp.id <> new.id
       and cp.effective_from <= new.effective_from
       and (cp.effective_to is null or cp.effective_to >= new.effective_from)
       and (cp.location_id is null or cp.location_id is not distinct from new.location_id)
     order by (cp.location_id is not null) desc, cp.effective_from desc, cp.created_at desc limit 1;
    perform audit_event(new.business_id, 'price.set', 'channel_price', new.id::text, v_reason,
      jsonb_build_object('variant', new.product_variant_id, 'channel', new.channel, 'price', v_was),
      jsonb_build_object('variant', new.product_variant_id, 'channel', new.channel, 'price', new.price,
                         'effective_from', new.effective_from)
      || case when new.location_id is not null
              then jsonb_build_object('place', (select name from location where id = new.location_id))
              else '{}'::jsonb end);
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    for k in select jsonb_object_keys(v_new) loop
      if (v_old -> k) is distinct from (v_new -> k) then
        v_before := v_before || jsonb_build_object(k, v_old -> k);
        v_after := v_after || jsonb_build_object(k, v_new -> k);
      end if;
    end loop;
    if v_after <> '{}' then
      perform audit_event(new.business_id, 'price.update', 'channel_price', new.id::text, v_reason,
        v_before || jsonb_build_object('variant', new.product_variant_id, 'channel', new.channel),
        v_after || jsonb_build_object('variant', new.product_variant_id, 'channel', new.channel));
    end if;
  elsif exists (select 1 from business where id = old.business_id) then
    perform audit_event(old.business_id, 'price.cancel', 'channel_price', old.id::text, v_reason, to_jsonb(old), null);
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- 6. What a place sends, and what is on its way to it
-- ---------------------------------------------------------------------------
-- A movement that sent stock to another place, or one that brought it back
-- when the transfer was cancelled on its way.
create or replace function sent_away(m inventory_movement) returns boolean
language sql immutable as $$
  select m.type = 'transfer_out' or (m.type = 'reversal' and m.reference_type = 'stock_transfer_cancel')
$$;

-- 0046's production_plan: what a place sends to another is its demand too, so
-- the central kitchen plans for what it sends the branches.
create or replace function production_plan(p_day date default null, p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('production.record', 'cost.view');
  v_loc uuid := resolve_location(v_business, p_location);
  v_tz text := (select timezone from business where id = v_business);
  v_day date := coalesce(p_day, business_local_date(v_business, now()));
  v_day_end timestamptz;
  r record; v_out jsonb := '[]'; v_first date; v_history int; v_weeks int; v_days jsonb; v_demand numeric;
  v_on_hand numeric; v_due numeric; v_good numeric; v_make numeric; v_batches numeric; v_status text;
  v_needs jsonb; v_plan_recipes uuid[] := '{}'; v_plan_batches numeric[] := '{}'; v_all jsonb;
begin
  v_day_end := (v_day + 1)::timestamp at time zone v_tz;
  for r in
    select rc.id, rc.name, rc.output_item_id as item_id, i.name as item, i.base_unit_code as unit,
           rc.batch_yield_base as yield, coalesce(rc.batch_yield_unit, i.base_unit_code) as yield_unit
      from recipe rc join item i on i.id = rc.output_item_id
     where rc.business_id = v_business and rc.is_active and rc.output_item_id is not null
       and rc.batch_yield_base > 0
     order by rc.name
  loop
    select business_local_date(v_business, min(m.occurred_at)) into v_first
      from inventory_movement m
     where m.business_id = v_business and m.item_id = r.item_id and m.location_id = v_loc;
    v_history := case when v_first is not null then v_day - v_first end;
    v_weeks := least(8, greatest(coalesce(v_history, 0), 0) / 7);
    v_days := '[]'; v_demand := null;
    if v_weeks >= 4 then
      select jsonb_agg(jsonb_build_object('day', d, 'used', trim_scale(u)) order by d desc), avg(u)
        into v_days, v_demand
        from (select (v_day - 7 * k) as d,
                     coalesce((select -sum(m.base_quantity_signed) from inventory_movement m
                                where m.business_id = v_business and m.item_id = r.item_id and m.location_id = v_loc
                                  and m.occurred_at >= (v_day - 7 * k)::timestamp at time zone v_tz
                                  and m.occurred_at < (v_day - 7 * k + 1)::timestamp at time zone v_tz
                                  and (stock_card_kind(m.type, m.reference_type, m.base_quantity_signed)
                                         in ('sold', 'batches') or sent_away(m))), 0) as u
                from generate_series(1, v_weeks) k) w;
    end if;
    v_on_hand := (item_position(v_business, r.item_id, v_loc)).qty;
    select coalesce(sum(lot.left_base), 0) into v_due
      from item_lot lot
     where lot.business_id = v_business and lot.item_id = r.item_id and lot.location_id = v_loc
       and lot.left_base > 0 and lot.use_by < v_day_end;
    v_good := greatest(v_on_hand - v_due, 0);
    if v_demand is null then
      v_status := 'no_history'; v_make := null; v_batches := 0;
    else
      v_make := greatest(v_demand - v_good, 0);
      v_batches := case when v_make > 0 then ceil(v_make / r.yield) else 0 end;
      v_status := case when v_batches > 0 then 'make' else 'enough' end;
    end if;
    v_needs := '[]';
    if v_batches > 0 then
      v_plan_recipes := v_plan_recipes || r.id;
      v_plan_batches := v_plan_batches || v_batches;
      select coalesce(jsonb_agg(jsonb_build_object(
               'item_id', n.item_id, 'item', i.name, 'base_unit', i.base_unit_code,
               'needed', trim_scale(n.qty), 'on_hand', trim_scale(n.on_hand),
               'short', trim_scale(greatest(n.qty - greatest(n.on_hand, 0), 0))) order by i.name), '[]'::jsonb)
        into v_needs
        from (select e.item_id, sum(e.base_qty) as qty, (item_position(v_business, e.item_id, v_loc)).qty as on_hand
                from expand_recipe(r.id, 'dine_in', v_batches, v_day) e group by e.item_id) n
        join item i on i.id = n.item_id;
    end if;
    v_out := v_out || jsonb_build_object(
      'recipe_id', r.id, 'recipe', r.name, 'item_id', r.item_id, 'item', r.item, 'base_unit', r.unit,
      'batch_yield', trim_scale(r.yield), 'yield_unit', r.yield_unit, 'status', v_status,
      'history_days', v_history, 'weeks', case when v_weeks >= 4 then v_weeks end, 'days', v_days,
      'demand', trim_scale(round(v_demand, 3)), 'on_hand', trim_scale(v_on_hand), 'due', trim_scale(v_due),
      'good', trim_scale(v_good), 'to_make', trim_scale(round(v_make, 3)), 'batches', v_batches,
      'makes', trim_scale(v_batches * r.yield), 'ingredients', v_needs);
  end loop;
  -- All the batches to make together: what each ingredient is short of.
  select coalesce(jsonb_agg(jsonb_build_object(
           'item_id', n.item_id, 'item', i.name, 'base_unit', i.base_unit_code,
           'needed', trim_scale(n.qty), 'on_hand', trim_scale(n.on_hand),
           'short', trim_scale(greatest(n.qty - greatest(n.on_hand, 0), 0))) order by i.name), '[]'::jsonb)
    into v_all
    from (select e.item_id, sum(e.base_qty) as qty, (item_position(v_business, e.item_id, v_loc)).qty as on_hand
            from unnest(v_plan_recipes, v_plan_batches) p(recipe_id, batches),
                 lateral expand_recipe(p.recipe_id, 'dine_in', p.batches, v_day) e
           group by e.item_id) n
    join item i on i.id = n.item_id;
  return jsonb_build_object('day', v_day, 'weekday', extract(isodow from v_day)::int,
                            'location_id', v_loc, 'location', (select name from location where id = v_loc),
                            'recipes', v_out, 'ingredients', v_all);
end $$;

-- 0045's buying_list: what a place sends is its use, and what is on its way
-- to it is coming, beside what is on order.
create or replace function buying_list(p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('cost.view');
  v_loc uuid := resolve_location(v_business, p_location);
  v_now timestamptz := now();
  v_today date := business_local_date(v_business, now());
  v_lead_cafe numeric := alert_setting(v_business, 'lead_time_days');
  v_out jsonb := '[]';
  x record; c jsonb;
  v_history int; v_days int; v_daily numeric; v_lead numeric; v_reorder numeric; v_reorder_from text;
  v_target numeric; v_target_from text; v_position numeric; v_status text; v_factor numeric; v_pack text;
  v_packs numeric; v_price numeric; v_price_from text; v_price_on date;
begin
  for x in
    with moves as (
      select m.item_id, sum(m.base_quantity_signed) as on_hand, min(m.occurred_at) as first_at,
             -sum(m.base_quantity_signed) filter (
                where m.occurred_at >= v_now - interval '28 days'
                  and (stock_card_kind(m.type, m.reference_type, m.base_quantity_signed) in ('sold', 'batches', 'wasted')
                       or sent_away(m)))
               as used
        from inventory_movement m
       where m.business_id = v_business and m.location_id = v_loc
       group by m.item_id
    ),
    open_po as (
      select o.id, o.po_no, o.status from purchase_order o
       where o.business_id = v_business and o.location_id = v_loc and o.status in ('draft', 'approved', 'sent')
    ),
    came as (
      select o.id as po_id, g.item_id, g.base_qty from open_po o cross join lateral po_received(o.id) g
    ),
    waiting as (
      select o.id, o.po_no, o.status, l.item_id, greatest(l.base_qty - coalesce(cm.base_qty, 0), 0) as base_qty
        from open_po o join purchase_order_line l on l.purchase_order_id = o.id
        left join came cm on cm.po_id = o.id and cm.item_id = l.item_id
    ),
    coming as (
      select w.item_id,
             coalesce(sum(w.base_qty) filter (where w.status <> 'draft'), 0) as on_order,
             coalesce(sum(w.base_qty) filter (where w.status = 'draft'), 0) as in_draft,
             coalesce(jsonb_agg(jsonb_build_object('po_id', w.id, 'po_no', w.po_no, 'status', w.status,
                                                   'base_qty', w.base_qty) order by w.po_no)
                        filter (where w.base_qty > 0), '[]'::jsonb) as orders
        from waiting w group by w.item_id
    ),
    -- What another place has sent here and is on its way (0055).
    on_way as (
      select l.item_id, sum(l.base_qty) as base_qty
        from stock_transfer t join stock_transfer_line l on l.transfer_id = t.id
       where t.business_id = v_business and t.to_location_id = v_loc and t.status = 'sent'
       group by l.item_id
    ),
    delivered as (
      select distinct on (d.item_id, d.supplier_id) d.*
        from (select (l ->> 'item_id')::uuid as item_id, (st ->> 'supplier_id')::uuid as supplier_id,
                     l ->> 'unit_code' as unit_code, (l ->> 'base_qty')::numeric as base_qty,
                     (l ->> 'goods_value')::numeric as goods_value, (st ->> 'received_on')::date as received_on,
                     g.received_at, g.receipt_no
                from goods_receipt g cross join lateral receipt_state(g.id) st
                cross join lateral jsonb_array_elements(st -> 'lines') l
               where g.business_id = v_business and g.received_at >= v_now - interval '365 days') d
       where d.supplier_id is not null and d.base_qty > 0
       order by d.item_id, d.supplier_id, d.received_at desc, d.receipt_no desc
    ),
    terms as (
      select t.item_id, t.supplier_id, sp.name as supplier, sp.lead_time_days, coalesce(s.preferred, false) as usual,
             s.updated_at as set_at, d.received_at as delivered_at, pk.unit as pack_unit,
             unit_factor(t.item_id, pk.unit) as factor, s.last_price, s.last_price_on,
             d.goods_value, d.base_qty as delivered_base, d.received_on
        from (select s.item_id, s.supplier_id from item_supplier s where s.business_id = v_business
              union
              select d.item_id, d.supplier_id from delivered d) t
        join supplier sp on sp.id = t.supplier_id and sp.is_active
        join item i on i.id = t.item_id
        left join item_supplier s on s.item_id = t.item_id and s.supplier_id = t.supplier_id
        left join delivered d on d.item_id = t.item_id and d.supplier_id = t.supplier_id
        cross join lateral (select case when unit_factor(i.id, s.pack_unit_code) is not null then s.pack_unit_code
                                        when unit_factor(i.id, d.unit_code) is not null then d.unit_code
                                        else i.base_unit_code end as unit) pk
    ),
    priced as (
      select t.*,
             case when t.last_price is not null and (t.received_on is null or t.last_price_on >= t.received_on)
                  then 'agreed' when t.received_on is not null then 'delivery' end as price_from
        from terms t
    ),
    choices as (
      select p.item_id,
             jsonb_agg(jsonb_build_object(
               'supplier_id', p.supplier_id, 'supplier', p.supplier, 'usual', p.usual,
               'lead_time', p.lead_time_days, 'pack_unit', p.pack_unit, 'pack_factor', p.factor,
               'price', case p.price_from when 'agreed' then p.last_price
                                          when 'delivery' then trim_scale(round(p.goods_value / p.delivered_base
                                                                                * p.factor, 2)) end,
               'price_from', p.price_from,
               'price_on', case p.price_from when 'agreed' then p.last_price_on when 'delivery' then p.received_on end,
               'from', case when p.usual then 'usual' when p.delivered_at is not null then 'last_delivery'
                            else 'set' end)
               order by p.usual desc, p.delivered_at desc nulls last, p.set_at desc nulls last, p.supplier)
               as list
        from priced p group by p.item_id
    )
    select i.id, i.name, i.base_unit_code, i.item_type, i.min_level_base, i.max_level_base, i.par_level_base,
           i.safety_stock_base, coalesce(m.on_hand, 0) as on_hand, m.first_at, coalesce(m.used, 0) as used,
           coalesce(cg.on_order, 0) as on_order, coalesce(cg.in_draft, 0) as in_draft,
           coalesce(ow.base_qty, 0) as on_way,
           coalesce(cg.orders, '[]'::jsonb) as orders, coalesce(ch.list, '[]'::jsonb) as choices
      from item i
      left join moves m on m.item_id = i.id
      left join coming cg on cg.item_id = i.id
      left join on_way ow on ow.item_id = i.id
      left join choices ch on ch.item_id = i.id
     where i.business_id = v_business and i.is_active
       and not exists (select 1 from recipe rc where rc.output_item_id = i.id and rc.is_active)
     order by i.name, i.id
  loop
    -- The history there is, and the use a day over it.
    v_history := case when x.first_at is not null then v_today - business_local_date(v_business, x.first_at) end;
    v_days := case when v_history is not null then least(28, v_history) end;
    v_daily := case when v_history >= 7 then greatest(x.used, 0) / v_days end;
    -- The supplier, its pack and a pack's price.
    c := x.choices -> 0;
    v_lead := coalesce((c ->> 'lead_time')::numeric, v_lead_cafe);
    v_pack := coalesce(c ->> 'pack_unit', x.base_unit_code);
    v_factor := coalesce((c ->> 'pack_factor')::numeric, 1);
    v_price := (c ->> 'price')::numeric;
    v_price_from := c ->> 'price_from';
    v_price_on := (c ->> 'price_on')::date;
    if v_price is null then
      v_price := trim_scale(round(item_reference_cost(v_business, x.id, v_loc) * v_factor, 2));
      v_price_from := case when v_price is not null then 'cost' end;
      v_price_on := null;
    end if;
    -- The levels.
    v_reorder := null; v_reorder_from := null; v_target := null; v_target_from := null;
    if x.min_level_base > 0 then
      v_reorder := x.min_level_base; v_reorder_from := 'item';
    elsif v_daily > 0 then
      v_reorder := v_daily * (v_lead + 1) + coalesce(greatest(x.safety_stock_base, 0), 0); v_reorder_from := 'use';
    end if;
    if v_reorder is not null then
      if x.par_level_base > 0 then v_target := x.par_level_base; v_target_from := 'par';
      elsif x.max_level_base > 0 then v_target := x.max_level_base; v_target_from := 'max';
      elsif v_daily > 0 then v_target := v_reorder + 7 * v_daily; v_target_from := 'week';
      else v_target := v_reorder; v_target_from := 'reorder';
      end if;
      v_target := greatest(v_target, v_reorder);
    end if;
    v_position := x.on_hand + x.on_order + x.in_draft + x.on_way;
    v_status := case when v_reorder is null and coalesce(v_history, 0) < 7 then 'no_history'
                     when v_reorder is null then 'not_used'
                     when v_position < v_reorder then 'order'
                     else 'enough' end;
    v_packs := case when v_status = 'order' then greatest(ceil((v_target - v_position) / v_factor), 1) else 0 end;
    v_out := v_out || jsonb_build_object(
      'item_id', x.id, 'item', x.name, 'base_unit', x.base_unit_code, 'item_type', x.item_type,
      'status', v_status,
      'on_hand', trim_scale(x.on_hand), 'on_order', trim_scale(x.on_order), 'in_draft', trim_scale(x.in_draft),
      'on_way', trim_scale(x.on_way),
      'position', trim_scale(v_position), 'orders', x.orders,
      'history_days', v_history, 'days', v_days, 'used', trim_scale(x.used),
      'daily_use', trim_scale(round(v_daily, 3)),
      'lead_time', v_lead, 'lead_from', case when c ->> 'lead_time' is not null then 'supplier' else 'cafe' end,
      'reorder_level', trim_scale(round(v_reorder, 3)), 'reorder_from', v_reorder_from,
      'safety_stock', case when v_reorder_from = 'use' and x.safety_stock_base > 0 then x.safety_stock_base end,
      'target_level', trim_scale(round(v_target, 3)), 'target_from', v_target_from,
      'supplier_id', c ->> 'supplier_id', 'supplier', c ->> 'supplier', 'supplier_from', c ->> 'from',
      'pack_unit', v_pack, 'pack_factor', v_factor,
      'packs', v_packs, 'qty_base', trim_scale(v_packs * v_factor),
      'price', v_price, 'price_from', v_price_from, 'price_on', v_price_on,
      'choices', x.choices);
  end loop;
  return jsonb_build_object(
    'location_id', v_loc, 'location', (select name from location where id = v_loc),
    'as_of', v_today, 'window_days', 28, 'lead_time', v_lead_cafe,
    'items', v_out);
end $$;

-- ---------------------------------------------------------------------------
-- 7. Paid from a branch's till
-- ---------------------------------------------------------------------------
-- An expense, a supplier's bill and a staff advance paid from the till come
-- out of the drawer at the branch named (none: the first branch, as before);
-- the expense is that branch's.
drop function if exists record_expense(text, numeric, text, text, date, uuid);
drop function if exists record_expense__run(text, numeric, text, text, date);
-- 0048's record_expense__run, at a branch.
create or replace function record_expense__run(
  p_description text, p_amount numeric, p_account_code text, p_paid_from text default 'cash', p_date date default null,
  p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('expense.record');
  v_me uuid := (current_member()).id;
  v_amount numeric; v_date date; v_acct gl_account; v_exp uuid := gen_random_uuid(); v_journal uuid;
  v_from text := lower(coalesce(p_paid_from, '')); v_location uuid;
begin
  if v_from = 'cash' then v_from := 'till'; end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if nullif(trim(p_description), '') is null then raise exception 'Describe the expense'; end if;
  select * into v_acct from gl_account where business_id = v_business and code = p_account_code and is_active;
  if not found or v_acct.account_type <> 'expense' or p_account_code in ('5000', '5050', '5300', '5310', '5400') then
    raise exception 'Account % cannot take an expense (stock costs come from their own records)', p_account_code;
  end if;
  if v_from not in ('till', 'safe', 'bank', 'card', 'owner') then
    raise exception 'Say where the money came from: the till, the safe, the bank, a card or the owner';
  end if;
  v_date := coalesce(p_date, business_local_date(v_business, now()));
  v_location := resolve_location(v_business, p_location);

  v_journal := post_journal(v_business, (v_date + time '12:00') at time zone (select timezone from business where id = v_business),
    'Expense: ' || trim(p_description), 'expense', v_exp,
    jsonb_build_array(jsonb_build_object('code', p_account_code, 'debit', v_amount),
                      jsonb_build_object('code', payment_account(v_from), 'credit', v_amount)));
  insert into expense (id, business_id, location_id, amount, incurred_on, description, journal_entry_id, created_by)
  values (v_exp, v_business, v_location, v_amount, v_date, trim(p_description), v_journal, v_me);
  perform pay_out_of(v_business, v_location, v_from, v_amount, 'expense', v_exp, v_me);
  return jsonb_build_object('expense_id', v_exp, 'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- 0035's record_expense, with the branch.
create or replace function record_expense(
  p_description text,
  p_amount numeric,
  p_account_code text,
  p_paid_from text DEFAULT 'cash'::text,
  p_date date DEFAULT NULL::date,
  p_location uuid default null,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_description', p_description, 'p_amount', p_amount, 'p_account_code', p_account_code, 'p_paid_from', p_paid_from, 'p_date', p_date)
                 || case when p_location is not null then jsonb_build_object('p_location', p_location) else '{}'::jsonb end;
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_expense', v_req);
  if v is not null then return v; end if;
  v := record_expense__run(p_description => p_description, p_amount => p_amount, p_account_code => p_account_code, p_paid_from => p_paid_from, p_date => p_date,
                           p_location => p_location);
  perform audit_event(v_business, 'expense.record', 'expense', v->>'expense_id', null, null,
    jsonb_build_object('description', p_description, 'amount', p_amount, 'account', p_account_code, 'paid_from', p_paid_from, 'journal_no', v->'journal_no'));
  perform idem_finish(v_business, p_idempotency_key, 'record_expense', v_req, v);
  return v;
end $$;

drop function if exists pay_bill(uuid, numeric, text, uuid);
drop function if exists pay_bill__run(uuid, numeric, text);
-- 0024's pay_bill (0035's pay_bill__run), from a branch's till.
create or replace function pay_bill__run(p_bill uuid, p_amount numeric, p_method text, p_location uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_me uuid := (current_member()).id;
  b purchase_invoice; v_amount numeric; v_pay uuid := gen_random_uuid(); v_journal uuid;
  v_from text := lower(coalesce(p_method, '')); v_location uuid;
begin
  if v_from = 'cash' then v_from := 'till'; elsif v_from = 'transfer' then v_from := 'bank'; end if;
  select * into b from purchase_invoice where id = p_bill and business_id = v_business for update;
  if not found then raise exception 'Bill not found'; end if;
  if b.cancelled_at is not null then raise exception 'That bill was cancelled; it is not owed'; end if;
  if v_from not in ('till', 'safe', 'bank', 'card', 'owner') then
    raise exception 'Say where the money came from: the till, the safe, the bank, a card or the owner';
  end if;
  v_amount := money_round(v_business, p_amount);
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if v_amount > b.amount_total - b.paid_amount then
    raise exception 'That is more than the % outstanding on this bill', b.amount_total - b.paid_amount;
  end if;
  v_location := resolve_location(v_business, p_location);
  v_journal := post_journal(v_business, now(), 'Payment — bill ' || coalesce(b.invoice_no, ''), 'supplier_payment', v_pay,
    jsonb_build_array(jsonb_build_object('code', '2000', 'debit', v_amount),
                      jsonb_build_object('code', payment_account(v_from), 'credit', v_amount)));
  insert into supplier_payment (id, business_id, supplier_id, purchase_invoice_id, amount, paid_on, method, journal_entry_id)
  values (v_pay, v_business, b.supplier_id, b.id, v_amount, business_local_date(v_business, now()), v_from, v_journal);
  perform pay_out_of(v_business, v_location, v_from, v_amount, 'supplier_payment', v_pay, v_me);
  return jsonb_build_object('payment_id', v_pay, 'journal_no', (select journal_no from journal_entry where id = v_journal),
    'outstanding', (select amount_total - paid_amount from purchase_invoice where id = p_bill));
end $$;

-- 0035's pay_bill, with the branch.
create or replace function pay_bill(
  p_bill uuid,
  p_amount numeric,
  p_method text,
  p_location uuid default null,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_bill', p_bill, 'p_amount', p_amount, 'p_method', p_method)
                 || case when p_location is not null then jsonb_build_object('p_location', p_location) else '{}'::jsonb end;
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'pay_bill', v_req);
  if v is not null then return v; end if;
  v := pay_bill__run(p_bill => p_bill, p_amount => p_amount, p_method => p_method, p_location => p_location);
  perform audit_event(v_business, 'purchase.pay', 'purchase_invoice', p_bill::text, null, null,
    jsonb_build_object('invoice_no', (select invoice_no from purchase_invoice where id = p_bill), 'amount', p_amount, 'paid_from', p_method));
  perform idem_finish(v_business, p_idempotency_key, 'pay_bill', v_req, v);
  return v;
end $$;

drop function if exists record_advance(uuid, numeric, text, text, uuid);
drop function if exists record_advance__run(uuid, numeric, text, text);
-- 0049's record_advance__run, from a branch's till.
create or replace function record_advance__run(p_employee uuid, p_amount numeric, p_paid_from text, p_reason text,
                                               p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.run');
  v_me uuid := (current_member()).id;
  v_from text := staff_paid_from(p_paid_from);
  v_amount numeric := money_round(v_business, p_amount);
  v_today date := business_local_date(v_business, now());
  e employee; v_id uuid := gen_random_uuid(); v_journal uuid; v_loc uuid;
begin
  if v_amount is null or v_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Say what the advance is for'; end if;
  e := staff_member(v_business, p_employee, true);
  if not works_on(e, v_today) then raise exception '% does not work here on %', e.full_name, v_today; end if;
  v_loc := resolve_location(v_business, p_location);
  v_journal := post_journal(v_business, now(), 'Advance to ' || e.full_name || ': ' || trim(p_reason),
    'employee_advance', v_id,
    jsonb_build_array(jsonb_build_object('code', '1300', 'debit', v_amount),
                      jsonb_build_object('code', payment_account(v_from), 'credit', v_amount)));
  insert into employee_advance (id, business_id, employee_id, amount, paid_from, location_id, reason, given_on,
                                journal_entry_id, created_by)
  values (v_id, v_business, e.id, v_amount, v_from, v_loc, trim(p_reason), v_today, v_journal, v_me);
  perform pay_out_of(v_business, v_loc, v_from, v_amount, 'employee_advance', v_id, v_me);
  return jsonb_build_object('advance_id', v_id, 'employee_id', e.id, 'name', e.full_name, 'amount', v_amount,
                            'paid_from', v_from, 'owed', advance_owed(v_business, e.id),
                            'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- 0049's record_advance, with the branch.
create or replace function record_advance(p_employee uuid, p_amount numeric, p_paid_from text, p_reason text,
                                          p_location uuid default null, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_employee', p_employee, 'p_amount', p_amount, 'p_paid_from', p_paid_from,
                                    'p_reason', p_reason)
                 || case when p_location is not null then jsonb_build_object('p_location', p_location) else '{}'::jsonb end;
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_advance', v_req);
  if v is not null then return v; end if;
  v := record_advance__run(p_employee => p_employee, p_amount => p_amount, p_paid_from => p_paid_from,
                           p_reason => p_reason, p_location => p_location);
  perform audit_event(v_business, 'payroll.advance', 'employee_advance', v ->> 'advance_id', p_reason, null,
    jsonb_build_object('name', v -> 'name', 'amount', v -> 'amount', 'paid_from', v -> 'paid_from', 'owed', v -> 'owed'));
  perform idem_finish(v_business, p_idempotency_key, 'record_advance', v_req, v);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 8. The menu at a branch
-- ---------------------------------------------------------------------------
-- 0041's pos_addons, at the till's branch: its own add-on prices first.
drop function if exists pos_addons();
create or replace function pos_addons(p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); v_today date; v_location uuid;
begin
  v_today := business_local_date(v_business, now());
  v_location := resolve_location(v_business, p_location);
  return jsonb_build_object(
    'groups', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', g.id, 'name', g.name, 'name_ar', g.name_ar, 'name_ckb', g.name_ckb,
                  'min', g.min_select, 'max', g.max_select,
                  'modifiers', (select coalesce(jsonb_agg(jsonb_build_object(
                                   'id', m.id, 'name', m.name, 'name_ar', m.name_ar, 'name_ckb', m.name_ckb,
                                   'prices', (select coalesce(jsonb_object_agg(ch, pr), '{}')
                                                from (select ch, modifier_price_on(m.id, ch, v_location, v_today) pr
                                                        from unnest(enum_range(null::sales_channel)) ch) z
                                               where pr is not null))
                                   order by m.sort_order, m.name), '[]')
                                  from modifier m where m.group_id = g.id and m.is_active))
                 order by g.sort_order, g.name), '[]')
                 from modifier_group g where g.business_id = v_business and g.is_active),
    'offers', (select coalesce(jsonb_agg(jsonb_build_object('product_id', o.product_id, 'variant_id', o.product_variant_id,
                                                           'group_id', o.group_id)
                                         order by o.product_id, o.sort_order), '[]')
                 from product_modifier_group o join modifier_group g on g.id = o.group_id
                where o.business_id = v_business and g.is_active));
end $$;

-- 0025's menu_scheduled: a price to come names its branch when it is one's own.
drop function if exists menu_scheduled();
create or replace function menu_scheduled()
returns table (kind text, id uuid, variant_id uuid, channel sales_channel, price numeric, effective_from date,
               version_no int, location text)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); v_today date;
begin
  v_today := business_local_date(v_business, now());
  return query
    select 'price'::text, cp.id, cp.product_variant_id, cp.channel, cp.price, cp.effective_from, null::int, l.name
      from channel_price cp left join location l on l.id = cp.location_id
     where cp.business_id = v_business and cp.effective_from > v_today
    union all
    select 'recipe'::text, rv.id, vr.product_variant_id, null::sales_channel, null::numeric, rv.effective_from,
           rv.version_no, null::text
      from recipe_version rv join variant_recipe vr on vr.recipe_id = rv.recipe_id
     where rv.business_id = v_business and rv.effective_from > v_today
       and (rv.effective_to is null or rv.effective_to >= rv.effective_from)
    order by 3, 6, 1;
end $$;

-- (cost.view) Each branch's own price in force today, for each size and
-- channel that has one, beside the café's.
create or replace function menu_branch_prices()
returns table (variant_id uuid, channel sales_channel, location_id uuid, location text, price numeric,
               effective_from date)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('cost.view'); v_today date;
begin
  v_today := business_local_date(v_business, now());
  return query
    select distinct on (cp.product_variant_id, cp.channel, cp.location_id)
           cp.product_variant_id, cp.channel, cp.location_id, l.name, cp.price, cp.effective_from
      from channel_price cp join location l on l.id = cp.location_id
     where cp.business_id = v_business and cp.location_id is not null
       and cp.effective_from <= v_today and (cp.effective_to is null or cp.effective_to >= v_today)
     order by cp.product_variant_id, cp.channel, cp.location_id, cp.effective_from desc, cp.created_at desc;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Who may call what
-- ---------------------------------------------------------------------------
-- Where a person works is checked inside, never called by hand.
revoke execute on function
  trg_user_role_place(), trg_user_role_one_place(), member_place(uuid), current_work_place(),
  assert_works_at(uuid), trg_works_here(), trg_sold_at_a_branch(), take_turn_no(uuid, date, uuid),
  invite_member__run(text, text, app_role[], uuid),
  set_price__run(uuid, sales_channel, numeric, date, uuid), sent_away(inventory_movement),
  record_expense__run(text, numeric, text, text, date, uuid), pay_bill__run(uuid, numeric, text, uuid),
  record_advance__run(uuid, numeric, text, text, uuid)
  from public, anon, authenticated;
-- Those made anew, or new, open to signed-in people; each checks its permission.
revoke execute on function
  invite_member(text, text, app_role[], uuid, uuid), set_member_place(uuid, uuid), list_members(),
  pos_catalogue(uuid), pos_open_bills(uuid), set_price(uuid, sales_channel, numeric, date, uuid, uuid),
  record_expense(text, numeric, text, text, date, uuid, uuid), pay_bill(uuid, numeric, text, uuid, uuid),
  record_advance(uuid, numeric, text, text, uuid, uuid), pos_addons(uuid), menu_scheduled(), menu_branch_prices()
  from public, anon;
grant execute on function
  invite_member(text, text, app_role[], uuid, uuid), set_member_place(uuid, uuid), list_members(),
  pos_catalogue(uuid), pos_open_bills(uuid), set_price(uuid, sales_channel, numeric, date, uuid, uuid),
  record_expense(text, numeric, text, text, date, uuid, uuid), pay_bill(uuid, numeric, text, uuid, uuid),
  record_advance(uuid, numeric, text, text, uuid, uuid), pos_addons(uuid), menu_scheduled(), menu_branch_prices()
  to authenticated;
