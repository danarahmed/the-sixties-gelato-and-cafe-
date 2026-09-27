-- =============================================================================
-- 0040 — Business rules, stock below zero, and losses added up (release O)
--
-- Until now the café's rules sat in four columns of the business row, changed
-- only in the database, with no history (docs/COMPLETION_PLAN.md, D7 and D11):
--   * A rule is now set on Settings → Rules, with a reason, by those who
--     manage the settings, and every change is kept: who, when, from what to
--     what, and why. A rule can be set for the whole café, and some for a role,
--     a kind of item or one item: the most particular one applies.
--   * The rules: the discount a cashier gives without a manager (per role), the
--     step a percentage discount is rounded to, the refund above which a
--     second person approves it (per role), the loss above which a manager
--     approves it (per role) and what it is added up over, and what happens
--     when more stock is used than the books hold.
--   * Stock below zero: each item is refused, sold with a manager's approval,
--     or sold with a red alert, as its rule says; by default made items are
--     refused and the rest alert. Sales, bills, losses, batches, corrections by
--     hand and corrected deliveries all ask.
--   * Losses are added up: one person's over their session (or the day), and
--     an item's by anyone over the day. Over the limit, a manager approves it
--     with their PIN, or it is saved to wait for their approval, shown under
--     Needs you; the manager approves it, or reverses it if it did not happen.
--   * The old columns stay, as the defaults, until they are retired.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The rules
-- ---------------------------------------------------------------------------
-- What each rule is: its kind of value, its limits, and how it may be set.
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
                              "label": "Using more stock than the books hold"}
  }'::jsonb
$$;

create table if not exists business_rule (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references business (id) on delete cascade,
  key          text not null,
  scope_type   text not null check (scope_type in ('business', 'role', 'location', 'item_type', 'item')),
  scope_id     text not null default '',
  value        jsonb,                        -- null: back to the default
  reason       text not null check (length(trim(reason)) > 0),
  set_by       uuid references app_user (id),
  set_at       timestamptz not null default now(),
  unique (business_id, key, scope_type, scope_id)
);

-- Every change, from what to what, and why: written by the rule's own trigger.
create table if not exists business_rule_history (
  id          bigint generated always as identity primary key,
  business_id uuid not null references business (id) on delete cascade,
  key         text not null,
  scope_type  text not null,
  scope_id    text not null,
  old_value   jsonb,
  new_value   jsonb,
  reason      text not null,
  changed_by  uuid references app_user (id),
  changed_at  timestamptz not null default now()
);
create index if not exists business_rule_history_idx on business_rule_history (business_id, changed_at desc, id desc);

create or replace function business_rule_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    -- A business removed takes its rules with it; nothing else removes one.
    if pg_trigger_depth() > 1 then return old; end if;
    raise exception 'A rule is never deleted: set it back to its default';
  end if;
  if tg_op = 'UPDATE' and (new.business_id, new.key, new.scope_type, new.scope_id)
                          is distinct from (old.business_id, old.key, old.scope_type, old.scope_id) then
    raise exception 'A rule keeps what it is for: set another one instead';
  end if;
  insert into business_rule_history (business_id, key, scope_type, scope_id, old_value, new_value, reason,
                                     changed_by, changed_at)
  values (new.business_id, new.key, new.scope_type, new.scope_id,
          case when tg_op = 'UPDATE' then old.value end, new.value, new.reason, new.set_by, new.set_at);
  return new;
end $$;
drop trigger if exists business_rule_write on business_rule;
create trigger business_rule_write before insert or update or delete on business_rule
  for each row execute function business_rule_write();
drop trigger if exists business_rule_history_append_only on business_rule_history;
create trigger business_rule_history_append_only before update or delete on business_rule_history
  for each row execute function forbid_mutation();

alter table business_rule enable row level security;
alter table business_rule force row level security;
drop policy if exists settings_read on business_rule;
create policy settings_read on business_rule for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('settings.manage')));
grant select on business_rule to authenticated;
alter table business_rule_history enable row level security;
alter table business_rule_history force row level security;
drop policy if exists settings_read on business_rule_history;
create policy settings_read on business_rule_history for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('settings.manage')));
grant select on business_rule_history to authenticated;

-- The defaults, as rules of their own: the business row's columns while they
-- last, the owner's decisions of the plan for the rest (a refund over 25,000
-- is approved by a second person; one person's losses are added up over their
-- session; made items are not sold beyond what was made, the rest alert).
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
$$;

-- The rows of a rule as they stand: those set, and the defaults nobody has set.
create or replace function rule_rows(p_business uuid, p_key text)
returns table (scope_type text, scope_id text, value jsonb, is_default boolean)
language sql stable set search_path = public as $$
  select r.scope_type, r.scope_id, r.value, false from business_rule r
   where r.business_id = p_business and r.key = p_key and r.value is not null
  union all
  select d.scope_type, d.scope_id, d.value, true from rule_defaults(p_business) d
   where d.key = p_key
     and not exists (select 1 from business_rule r
                      where r.business_id = p_business and r.key = p_key and r.scope_type = d.scope_type
                        and r.scope_id = d.scope_id and r.value is not null)
$$;

-- The value that applies: an item's own, its kind's, the location's, the most
-- any of the person's roles allows, then the café's.
create or replace function rule_value(p_business uuid, p_key text, p_item uuid default null,
                                      p_roles app_role[] default null, p_location uuid default null)
returns jsonb language plpgsql stable set search_path = public as $$
declare v jsonb; v_type text;
begin
  if p_item is not null then
    select x.value into v from rule_rows(p_business, p_key) x
     where x.scope_type = 'item' and x.scope_id = p_item::text;
    if found then return v; end if;
    select i.item_type::text into v_type from item i where i.id = p_item;
    select x.value into v from rule_rows(p_business, p_key) x
     where x.scope_type = 'item_type' and x.scope_id = v_type;
    if found then return v; end if;
  end if;
  if p_location is not null then
    select x.value into v from rule_rows(p_business, p_key) x
     where x.scope_type = 'location' and x.scope_id = p_location::text;
    if found then return v; end if;
  end if;
  if coalesce(cardinality(p_roles), 0) > 0 then
    select x.value into v from rule_rows(p_business, p_key) x
     where x.scope_type = 'role' and x.scope_id = any (p_roles::text[])
     order by (x.value #>> '{}')::numeric desc limit 1;
    if found then return v; end if;
  end if;
  select x.value into v from rule_rows(p_business, p_key) x where x.scope_type = 'business';
  return v;
end $$;

-- A number rule as it applies to one person, through their roles.
create or replace function member_rule_number(p_business uuid, p_key text, p_member uuid) returns numeric
language sql stable set search_path = public as $$
  select (rule_value(p_business, p_key, null,
                     (select coalesce(array_agg(ur.role), '{}') from user_role ur where ur.app_user_id = p_member))
          #>> '{}')::numeric
$$;

-- ---------------------------------------------------------------------------
-- 2. Setting a rule, and reading them all (Settings → Rules)
-- ---------------------------------------------------------------------------
-- A value, or null to go back to the default; always with a reason.
create or replace function set_business_rule__run(p_key text, p_scope_type text, p_scope_id text, p_value jsonb,
                                                  p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_me uuid := (current_member()).id;
  d jsonb := rule_definitions() -> p_key;
  v_scope text := coalesce(nullif(trim(p_scope_id), ''), '');
  v_value jsonb := case when p_value is null or jsonb_typeof(p_value) = 'null' then null else p_value end;
  v_reason text := trim(p_reason);
  v_num numeric; v_old jsonb; v_had boolean; v_before jsonb; v_after jsonb; v_name text;
begin
  if d is null then raise exception 'Unknown rule'; end if;
  if nullif(v_reason, '') is null then raise exception 'Say why the rule is changing'; end if;
  if not coalesce((d -> 'scopes') ? p_scope_type, false) then raise exception 'This rule is not set that way'; end if;
  if p_scope_type = 'business' then
    v_scope := '';
  elsif p_scope_type = 'role' then
    if not v_scope = any (enum_range(null::app_role)::text[]) then raise exception 'Unknown role'; end if;
  elsif p_scope_type = 'item_type' then
    if not v_scope = any (enum_range(null::item_type)::text[]) then raise exception 'Unknown kind of item'; end if;
  elsif p_scope_type = 'item' then
    select name into v_name from item where id::text = v_scope and business_id = v_business;
    if not found then raise exception 'Unknown item'; end if;
  elsif p_scope_type = 'location' then
    select name into v_name from location where id::text = v_scope and business_id = v_business;
    if not found then raise exception 'Unknown location'; end if;
  end if;

  if v_value is not null then
    if d ->> 'kind' = 'choice' then
      if jsonb_typeof(v_value) <> 'string' or not (d -> 'choices') ? (v_value #>> '{}') then
        raise exception 'That is not one of this rule''s choices';
      end if;
      if p_key = 'negative_stock' and v_value #>> '{}' = 'allow' and p_scope_type <> 'item' then
        raise exception 'Using stock the books do not hold, with no alert, is for chosen items only';
      end if;
    else
      if jsonb_typeof(v_value) <> 'number' then raise exception 'Enter a number'; end if;
      v_num := (v_value #>> '{}')::numeric;
      if v_num < (d ->> 'min')::numeric or v_num > (d ->> 'max')::numeric then
        raise exception 'Enter a number from % to %', d ->> 'min', d ->> 'max';
      end if;
      if (d ->> 'whole')::boolean and v_num <> trunc(v_num) then raise exception 'Enter a whole number'; end if;
      v_value := to_jsonb(trim_scale(v_num));
    end if;
  end if;

  v_before := case p_scope_type
                when 'business' then rule_value(v_business, p_key)
                when 'item' then rule_value(v_business, p_key, v_scope::uuid)
                when 'role' then rule_value(v_business, p_key, null, array[v_scope::app_role])
                when 'location' then rule_value(v_business, p_key, null, null, v_scope::uuid)
                else (select x.value from rule_rows(v_business, p_key) x
                       where x.scope_type = p_scope_type and x.scope_id = v_scope) end;
  select value, true into v_old, v_had from business_rule
   where business_id = v_business and key = p_key and scope_type = p_scope_type and scope_id = v_scope for update;
  if coalesce(v_had, false) then
    if v_old is not distinct from v_value then raise exception 'That is the rule already'; end if;
    update business_rule set value = v_value, reason = v_reason, set_by = v_me, set_at = now()
     where business_id = v_business and key = p_key and scope_type = p_scope_type and scope_id = v_scope;
  else
    if v_value is null then raise exception 'That is the rule already'; end if;
    insert into business_rule (business_id, key, scope_type, scope_id, value, reason, set_by)
    values (v_business, p_key, p_scope_type, v_scope, v_value, v_reason, v_me);
  end if;
  v_after := case p_scope_type
               when 'business' then rule_value(v_business, p_key)
               when 'item' then rule_value(v_business, p_key, v_scope::uuid)
               when 'role' then rule_value(v_business, p_key, null, array[v_scope::app_role])
               when 'location' then rule_value(v_business, p_key, null, null, v_scope::uuid)
               else (select x.value from rule_rows(v_business, p_key) x
                      where x.scope_type = p_scope_type and x.scope_id = v_scope) end;
  -- On the trail: which rule, what it applies to (a role, a kind of item, an
  -- item or a branch by name; nothing for the whole café), from what to what.
  perform audit_event(v_business, 'rule.set', 'business_rule',
    p_key || case when p_scope_type = 'business' then '' else ':' || p_scope_type || ':' || v_scope end,
    v_reason,
    jsonb_build_object('business_rule', p_key, 'applies_to', coalesce(v_name, nullif(v_scope, '')),
                       'value', v_before),
    jsonb_build_object('business_rule', p_key, 'applies_to', coalesce(v_name, nullif(v_scope, '')),
                       'value', v_after));
  return jsonb_build_object('key', p_key, 'scope_type', p_scope_type, 'scope_id', v_scope, 'value', v_after,
                            'default', v_value is null);
end $$;

create or replace function set_business_rule(p_key text, p_scope_type text, p_scope_id text, p_value jsonb,
                                             p_reason text, p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_key', p_key, 'p_scope_type', p_scope_type, 'p_scope_id', p_scope_id,
                                    'p_value', p_value, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_business_rule', v_req);
  if v is not null then return v; end if;
  v := set_business_rule__run(p_key, p_scope_type, p_scope_id, p_value, p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'set_business_rule', v_req, v);
  return v;
end $$;

-- Every rule: what it is, each row that applies (who set it, when and why, or
-- the default), and the last 200 changes.
create or replace function list_business_rules() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage');
begin
  return jsonb_build_object(
    'definitions', rule_definitions(),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
               'key', k.key, 'scope_type', x.scope_type, 'scope_id', x.scope_id,
               'scope_name', case x.scope_type
                               when 'item' then (select i.name from item i where i.id::text = x.scope_id)
                               when 'location' then (select l.name from location l where l.id::text = x.scope_id) end,
               'value', x.value, 'is_default', x.is_default,
               'reason', r.reason, 'set_by', u.full_name, 'set_at', r.set_at)
             order by k.key, case x.scope_type when 'business' then 0 when 'role' then 1 when 'location' then 2
                                               when 'item_type' then 3 else 4 end, x.scope_id), '[]'::jsonb)
               from jsonb_object_keys(rule_definitions()) k(key)
               cross join lateral rule_rows(v_business, k.key) x
               left join business_rule r on not x.is_default and r.business_id = v_business and r.key = k.key
                                        and r.scope_type = x.scope_type and r.scope_id = x.scope_id
               left join app_user u on u.id = r.set_by),
    'history', (select coalesce(jsonb_agg(jsonb_build_object(
                  'key', h.key, 'scope_type', h.scope_type, 'scope_id', h.scope_id,
                  'scope_name', case h.scope_type
                                  when 'item' then (select i.name from item i where i.id::text = h.scope_id)
                                  when 'location' then (select l.name from location l where l.id::text = h.scope_id) end,
                  'old_value', h.old_value, 'new_value', h.new_value, 'reason', h.reason,
                  'changed_by', u.full_name, 'changed_at', h.changed_at)
                order by h.changed_at desc, h.id desc), '[]'::jsonb)
                  from (select * from business_rule_history where business_id = v_business
                         order by changed_at desc, id desc limit 200) h
                  left join app_user u on u.id = h.changed_by));
end $$;

-- ---------------------------------------------------------------------------
-- 3. Approvals for losses and for stock below zero
-- ---------------------------------------------------------------------------
-- A loss over the limit is approved by whoever approves losses; stock below
-- zero by whoever approves stock corrections.
alter table approval drop constraint if exists approval_kind_check;
alter table approval add constraint approval_kind_check
  check (kind in ('discount', 'void', 'refund', 'waste', 'negative_stock'));
create or replace function approval_permission(p_kind text) returns text
language sql immutable set search_path = public as $$
  select case p_kind when 'discount' then 'discount.approve' when 'void' then 'sale.void'
                     when 'refund' then 'sale.refund' when 'waste' then 'waste.approve'
                     when 'negative_stock' then 'inventory.adjust.approve' end
$$;


-- 0028's set_my_pin, for those who approve losses and stock below zero too.
create or replace function set_my_pin(p_pin text) returns void
language plpgsql security definer set search_path = public as $$
declare v_me app_user := current_member();
begin
  if v_me.id is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if not (current_has_permission('discount.approve') or current_has_permission('sale.void')
          or current_has_permission('sale.refund') or current_has_permission('waste.approve')
          or current_has_permission('inventory.adjust.approve')) then
    raise exception 'Only those who approve discounts, voids, refunds, losses or stock below zero have a PIN'
      using errcode = '42501';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then raise exception 'A PIN is 4 to 8 digits'; end if;
  if p_pin ~ '^(.)\1+$' or '0123456789' like '%' || p_pin || '%' or '9876543210' like '%' || p_pin || '%' then
    raise exception 'Choose a PIN that is harder to guess';
  end if;
  update app_user set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 8)) where id = v_me.id;
  perform audit_event(v_me.business_id, 'member.pin_set', 'app_user', v_me.id::text, null, null, null);
end $$;


-- 0028's list_approvers, for those who record losses and batches too.
create or replace function list_approvers(p_kind text)
returns table (id uuid, name text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create', 'waste.record', 'production.record');
  v_perm text := approval_permission(p_kind);
begin
  if v_perm is null then raise exception 'Unknown approval'; end if;
  return query
    select au.id, au.full_name from app_user au
     where au.business_id = v_business and au.is_active and au.pin_hash is not null
       and au.id is distinct from (current_member()).id
       and member_has_permission(au.id, v_perm)
     order by au.full_name;
end $$;


-- 0035's request_approval, for those who record losses and batches too.
create or replace function request_approval(p_kind text, p_approver uuid, p_pin text, p_scope jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create', 'waste.record', 'production.record');
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

-- ---------------------------------------------------------------------------
-- 4. Stock below zero, as the rules say
-- ---------------------------------------------------------------------------
-- What would take an item beyond what the books hold at a location: each
-- item's need against its position, with its rule.
create or replace function stock_shortfalls(p_business uuid, p_location uuid, p_needs jsonb)
returns table (item_id uuid, name text, unit text, have numeric, need numeric, policy text)
language sql stable set search_path = public as $$
  select n.item_id, i.name, i.base_unit_code, p.qty, n.need,
         coalesce(rule_value(p_business, 'negative_stock', n.item_id) #>> '{}', 'alert')
    from (select (x ->> 'item_id')::uuid as item_id, sum((x ->> 'qty')::numeric) as need
            from jsonb_array_elements(coalesce(p_needs, '[]'::jsonb)) x group by 1) n
    join item i on i.id = n.item_id
    cross join lateral item_position(p_business, n.item_id, p_location) p
   where n.need > 0 and p.qty < n.need
   order by i.name, n.item_id
$$;

-- Refuses what the rules refuse. An item whose rule asks for a manager is
-- used when the person approves that kind themselves, when they bring an
-- approval of the kind, or when one was already given (p_approved_by); the
-- audit trail keeps who. Returns the approver, when one was needed.
create or replace function stock_rules(p_business uuid, p_location uuid, p_needs jsonb, p_member uuid,
                                       p_approval uuid, p_kind text, p_for text, p_approved_by uuid default null)
returns uuid language plpgsql set search_path = public as $$
declare s record; v_names text; v_have numeric; v_unit text; v_name text; v_by uuid; a approval;
begin
  for s in select * from stock_shortfalls(p_business, p_location, p_needs) loop
    if s.policy = 'block' then
      raise exception '%', format('Only %s %s of %s is in stock: record the delivery or the batch first, or count it',
                                  trim_scale(greatest(s.have, 0)), s.unit, s.name);
    end if;
    if s.policy = 'approve' then
      v_names := concat_ws(', ', v_names, format('%s ×%s %s', s.name, trim_scale(s.need), s.unit));
      if v_name is null then
        v_have := greatest(s.have, 0); v_unit := s.unit; v_name := s.name;
      end if;
    end if;
  end loop;
  if v_name is null then return null; end if;
  if p_approved_by is not null then
    v_by := p_approved_by;
  elsif member_has_permission(p_member, approval_permission(p_kind)) then
    v_by := p_member;
  elsif p_approval is not null then
    a := use_approval(p_business, p_approval, p_kind, p_for);
    v_by := a.approver_id;
  else
    raise exception '%', format('Only %s %s of %s is in stock: a manager approves using more than that',
                                trim_scale(v_have), v_unit, v_name);
  end if;
  perform audit_event(p_business, 'stock.below_zero', 'stock', p_for, null, null,
    jsonb_build_object('items', v_names, 'approved_by', v_by));
  return v_by;
end $$;
-- ---------------------------------------------------------------------------
-- 5. Sales and bills: stock below zero as the rules say
-- ---------------------------------------------------------------------------

-- 0037's post_sale: stock the books do not hold is sold as each item's rule
-- says, and a manager's approval for it is passed by the till.
drop function if exists post_sale(uuid, uuid, uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, boolean,
                                  jsonb, int);
create or replace function post_sale(
  p_business uuid, p_me uuid, p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type,
  p_lines jsonb, p_location uuid, p_discount_percent numeric, p_discount_amount numeric,
  p_trust_line_prices boolean default false, p_discount jsonb default null, p_turn_no int default null,
  p_stock_approval uuid default null)
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
begin
  if p_idempotency_key is null then
    raise exception 'A sale needs its idempotency key';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'The cart is empty';
  end if;
  if p_tender not in ('cash', 'card', 'platform_paid') then
    raise exception 'Tender % is not supported', p_tender;
  end if;
  if is_platform_channel(p_channel) <> (p_tender = 'platform_paid') then
    raise exception 'Delivery-platform orders are platform-paid, and only they are';
  end if;

  -- Replay: the same key returns the sale it already recorded.
  select id, gross_amount, discount_amount, net_amount, cogs_amount, turn_no into v_existing
    from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'gross', v_existing.gross_amount,
             'discount', v_existing.discount_amount, 'net', v_existing.net_amount, 'replayed', true,
             'turn_no', v_existing.turn_no)
           || sale_cost_view(v_existing.cogs_amount);
  end if;

  if (p_discount_percent is not null or p_discount_amount is not null) and is_platform_channel(p_channel) then
    raise exception 'A delivery platform sets its own discounts; none is given at the till';
  end if;
  v_location := resolve_location(v_business, p_location);
  v_today := business_local_date(v_business, now());

  insert into sales_order (business_id, location_id, channel, status, idempotency_key,
                           gross_amount, discount_amount, net_amount, cogs_amount, cashier_id)
  values (v_business, v_location, p_channel, 'open', p_idempotency_key, 0, 0, 0, 0, v_me)
  on conflict (business_id, idempotency_key) do nothing
  returning id into v_order;
  if v_order is null then
    -- A concurrent request with this key won the race; return its sale.
    select id, gross_amount, discount_amount, net_amount, cogs_amount, turn_no into v_existing
      from sales_order where business_id = v_business and idempotency_key = p_idempotency_key;
    return jsonb_build_object('order_id', v_existing.id, 'gross', v_existing.gross_amount,
             'discount', v_existing.discount_amount, 'net', v_existing.net_amount, 'replayed', true,
             'turn_no', v_existing.turn_no)
           || sale_cost_view(v_existing.cogs_amount);
  end if;

  -- Lock every item this sale touches, in a stable order.
  select array_agg(distinct e.item_id) into v_items
    from jsonb_array_elements(p_lines) x,
         lateral expand_variant((x ->> 'variant_id')::uuid, p_channel, (x ->> 'qty')::numeric, v_today) e;
  if v_items is not null then perform lock_items(v_items); end if;

  -- What the books do not hold is sold as its rule says (0040): refused, sold
  -- with a manager's approval, or sold and shown as an alert.
  if v_items is not null then
    select jsonb_agg(jsonb_build_object('item_id', e.item_id, 'qty', e.base_qty)) into v_needs
      from jsonb_array_elements(p_lines) x,
           lateral expand_variant((x ->> 'variant_id')::uuid, p_channel, (x ->> 'qty')::numeric, v_today) e;
    v_stock_by := stock_rules(v_business, v_location, v_needs, v_me, p_stock_approval, 'negative_stock',
                              v_order::text);
  end if;

  -- Price every line first: the discount is shared out over the whole bill.
  for l in select * from jsonb_array_elements(p_lines) loop
    v_variant := (l ->> 'variant_id')::uuid;
    v_qty := (l ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Each line needs a positive quantity'; end if;
    if not exists (select 1 from product_variant pv join product p on p.id = pv.product_id
                    where pv.id = v_variant and pv.business_id = v_business and pv.is_active and p.is_active) then
      raise exception 'That product is not on sale';
    end if;
    -- A bill's printed price, passed by settle_tab alone (0025); otherwise today's.
    v_price := case when p_trust_line_prices and nullif(l ->> 'price', '') is not null
                    then (l ->> 'price')::numeric
                    else price_on(v_variant, p_channel, v_location, v_today) end;
    if v_price is null then
      raise exception 'No % price is set for this product', p_channel;
    end if;
    v_variants := v_variants || v_variant;
    v_qtys := v_qtys || v_qty;
    v_prices := v_prices || v_price;
    v_gross_lines := v_gross_lines || money_round(v_business, v_price * v_qty);
    v_gross := v_gross + money_round(v_business, v_price * v_qty);
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

  n := cardinality(v_variants);
  for i in 1 .. n loop
    -- One costed movement per component per line, so every figure ties:
    -- line COGS = its movements; order COGS = all movements = the journal.
    -- Cost first, then write the line once: lines are append-only. Each
    -- movement names its line (0037), so a refund of the line takes back its
    -- own stock.
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

    insert into sales_order_line (id, sales_order_id, product_variant_id, quantity, unit_price, line_discount, line_net,
                                  cogs_amount)
    values (v_line, v_order, v_variants[i], v_qtys[i], v_prices[i], v_gross_lines[i] - v_nets[i], v_nets[i],
            v_line_cogs);
    v_cogs := v_cogs + v_line_cogs;
  end loop;

  insert into sales_tender (sales_order_id, tender_type, amount) values (v_order, p_tender, v_net);

  -- Its turn number (0034): the bill's own, or the next of the day. Taken in
  -- the sale's own transaction, so a sale refused takes none.
  v_turn := coalesce(p_turn_no, take_turn_no(v_business, v_today));
  update sales_order
     set gross_amount = v_gross, discount_amount = v_discount, net_amount = v_net, cogs_amount = v_cogs,
         discount_percent = case when v_discount > 0 then p_discount_percent end,
         discount_by = v_disc_by, discount_approved_by = v_disc_approved, discount_reason = v_disc_reason,
         status = 'completed', turn_no = v_turn
   where id = v_order;

  -- Revenue at the full price; the discount on its own line (none posts when it is zero).
  v_journal := post_journal(v_business, now(), 'Sale ' || left(v_order::text, 8), 'sales_order', v_order,
    jsonb_build_array(
      jsonb_build_object('code', tender_account(p_tender), 'debit', v_net),
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
    'turn_no', v_turn)
    || sale_cost_view(v_cogs);
end $$;


-- 0031's record_sale, passing a manager's approval of stock below zero.
drop function if exists record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text,
                                    uuid, text);
create or replace function record_sale(
  p_idempotency_key uuid, p_channel sales_channel, p_tender tender_type, p_lines jsonb,
  p_location uuid default null, p_discount_percent numeric default null, p_discount_amount numeric default null,
  p_expected_net numeric default null, p_discount_reason text default null, p_discount_note text default null,
  p_approval uuid default null, p_platform_order_no text default null, p_stock_approval uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create'); r jsonb;
  v_no text := nullif(trim(p_platform_order_no), ''); v_platform uuid; v_at timestamptz;
  v_pname text; v_active boolean;
begin
  if (p_discount_percent is not null or p_discount_amount is not null)
     and not current_has_permission('discount.apply') then
    raise exception 'You do not have permission to give discounts' using errcode = '42501';
  end if;
  -- A platform sale goes through one of the café's platforms, in use; a sale
  -- it already recorded, sent again by a till that was offline, is replayed.
  if is_platform_channel(p_channel) then
    select id, name, is_active into v_platform, v_pname, v_active
      from delivery_platform where business_id = v_business and code = p_channel::text;
    if not exists (select 1 from sales_order where business_id = v_business and idempotency_key = p_idempotency_key) then
      if v_platform is null then
        raise exception '% is not one of the café''s delivery platforms: add it on Delivery Platforms', initcap(p_channel::text);
      end if;
      if not v_active then
        raise exception '% is no longer in use: bring it back on Delivery Platforms to sell through it', v_pname;
      end if;
    end if;
  end if;
  r := post_sale(v_business, (current_member()).id, p_idempotency_key, p_channel, p_tender, p_lines,
                 p_location, p_discount_percent, p_discount_amount, false,
                 jsonb_build_object('reason', p_discount_reason, 'note', p_discount_note, 'approval', p_approval),
                 p_stock_approval => p_stock_approval);
  perform assert_sale_total(r, p_expected_net);
  -- A replay is the sale already recorded, with its number.
  if is_platform_channel(p_channel) and not coalesce((r ->> 'replayed')::boolean, false) then
    if v_no is null then
      raise exception 'Enter the % order number', v_pname;
    end if;
    if length(v_no) > 40 or v_no !~ '^[A-Za-z0-9#/_.-]+$' then
      raise exception 'An order number is letters and digits, as the % tablet shows it', v_pname;
    end if;
    select o.placed_at into v_at
      from platform_order po join sales_order o on o.id = po.sales_order_id
     where po.business_id = v_business and po.platform_id = v_platform and lower(po.external_order_id) = lower(v_no);
    if found then
      raise exception '% order % is already recorded, on the sale of %', v_pname, v_no,
        to_char(v_at at time zone (select timezone from business where id = v_business), 'DD Mon HH24:MI');
    end if;
    insert into platform_order (business_id, platform_id, location_id, external_order_id, status, store_list_value,
                                customer_payment, sales_order_id, placed_at, import_source)
    select v_business, v_platform, o.location_id, v_no, 'completed', o.gross_amount, o.net_amount, o.id, o.placed_at, 'till'
      from sales_order o where o.id = (r ->> 'order_id')::uuid;
    r := r || jsonb_build_object('platform_order_no', v_no);
  end if;
  return r;
end $$;


-- 0034's settle_tab, passing a manager's approval of stock below zero.
drop function if exists settle_tab(uuid, int, uuid, tender_type, numeric);
create or replace function settle_tab(p_tab uuid, p_version int, p_idempotency_key uuid, p_tender tender_type,
                                      p_expected_net numeric default null, p_stock_approval uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('sale.create'); t pos_tab; v_lines jsonb; r jsonb;
begin
  select * into t from pos_tab where id = p_tab and business_id = v_business for update;
  if not found then raise exception 'Bill not found'; end if;
  if t.status = 'paid' then
    return (select jsonb_build_object(
              'tab_id', t.id, 'order_id', o.id, 'replayed', true,
              'gross', o.gross_amount, 'discount', o.discount_amount, 'net', o.net_amount,
              'journal_no', (select journal_no from journal_entry
                              where reference_type = 'sales_order' and reference_id = o.id
                                and reverses_entry is null limit 1),
              'turn_no', o.turn_no)
              from sales_order o where o.id = t.sales_order_id);
  end if;
  t := lock_open_tab(v_business, p_tab, p_version);
  select jsonb_agg(jsonb_build_object('variant_id', product_variant_id, 'qty', qty, 'price', unit_price)
                   order by position)
    into v_lines from pos_tab_line where tab_id = p_tab;
  if v_lines is null then raise exception 'The bill is empty'; end if;
  r := post_sale(v_business, (current_member()).id, p_idempotency_key, t.channel, p_tender, v_lines,
                 t.location_id, t.discount_percent, t.discount_amount, true,
                 jsonb_build_object('checked', true, 'by', t.discount_by, 'approved_by', t.discount_approved_by,
                                    'reason', t.discount_reason),
                 t.turn_no, p_stock_approval);
  if coalesce((r ->> 'replayed')::boolean, false) then
    -- That key already paid for something else: never attach its sale to this bill.
    raise exception 'That payment was already used for another sale. Try again.';
  end if;
  perform assert_sale_total(r, p_expected_net);
  update pos_tab
     set status = 'paid', sales_order_id = (r ->> 'order_id')::uuid, closed_at = now(),
         closed_by = (current_member()).id, turn_no = (r ->> 'turn_no')::int
   where id = p_tab;
  return r || jsonb_build_object('tab_id', p_tab);
end $$;

-- ---------------------------------------------------------------------------
-- 6. Losses: added up, approved, or waiting for approval
-- ---------------------------------------------------------------------------
-- A manager's look at a loss: approved with their PIN as it was recorded, or
-- afterwards, or reversed because it did not happen. The loss itself never
-- changes: a stock movement is never edited.
create table if not exists loss_review (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references business (id) on delete cascade,
  movement_id          uuid not null unique references inventory_movement (id),
  decision             text not null check (decision in ('approved', 'reversed')),
  reason               text,
  decided_by           uuid not null references app_user (id),
  decided_at           timestamptz not null default now(),
  reversal_movement_id uuid references inventory_movement (id),
  journal_entry_id     uuid references journal_entry (id)
);
alter table loss_review enable row level security;
alter table loss_review force row level security;
drop policy if exists waste_read on loss_review;
create policy waste_read on loss_review for select to authenticated
  using (business_id = (select current_business_id()) and (select current_has_permission('waste.approve')));
grant select on loss_review to authenticated;
drop trigger if exists loss_review_append_only on loss_review;
create trigger loss_review_append_only before update or delete on loss_review
  for each row execute function forbid_mutation();

-- The kinds of movement that are losses.
create or replace function is_loss(p_type movement_type) returns boolean
language sql immutable set search_path = public as $$
  select p_type in ('waste', 'spoilage', 'expired', 'damaged', 'melt_evaporation',
                    'staff_consumption', 'complimentary', 'sampling')
$$;

-- What was lost since a moment: by one person, or of one item, or both; a
-- loss reversed is not a loss.
create or replace function losses_since(p_business uuid, p_member uuid, p_item uuid, p_since timestamptz)
returns numeric language sql stable set search_path = public as $$
  select coalesce(sum(m.value), 0) from inventory_movement m
   where m.business_id = p_business and is_loss(m.type) and m.base_quantity_signed < 0
     and m.created_at >= p_since
     and (p_member is null or m.app_user_id = p_member)
     and (p_item is null or m.item_id = p_item)
     and not exists (select 1 from loss_review r where r.movement_id = m.id and r.decision = 'reversed')
$$;

-- 0035's record_waste__run, with the rules of 0040. Over the limit on its own,
-- or added to the person's losses over the window (their open session, or the
-- day), or to the item's losses by anyone today: a manager approves it by
-- recording it, or with their PIN (p_approval); otherwise it is refused, or,
-- when asked (p_wait), saved to wait for a manager's approval. Stock and books
-- move either way: the stock is gone.
drop function if exists record_waste__run(uuid, numeric, text, movement_type, text, uuid);
create or replace function record_waste__run(p_item uuid, p_qty numeric, p_unit_code text, p_type movement_type,
                                  p_reason text, p_location uuid default null, p_approval uuid default null,
                                  p_wait boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('waste.record');
  v_me uuid := (current_member()).id;
  v_location uuid; v_base numeric; v_cost numeric; v_value numeric; v_mv uuid; v_journal uuid;
  v_limit numeric; v_window text; v_today date; v_day_start timestamptz; v_since timestamptz;
  v_over boolean; v_approver uuid; a approval; v_status approval_status;
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
  -- One person's losses are added up one at a time; so are an item's.
  perform pg_advisory_xact_lock(hashtextextended('losses:' || v_business::text || ':' || v_me::text, 0));
  perform lock_items(array[p_item]);
  v_cost := item_issue_cost(v_business, p_item, v_location);
  v_value := money_round(v_business, v_cost * v_base);

  -- A manager approves it by recording it, or with their PIN on the spot.
  if current_has_permission('waste.approve') then
    v_approver := v_me;
  elsif p_approval is not null then
    a := use_approval(v_business, p_approval, 'waste', p_item::text);
    v_approver := a.approver_id;
  end if;

  -- More than the books hold is lost as the item's rule says.
  perform stock_rules(v_business, v_location, jsonb_build_array(jsonb_build_object('item_id', p_item, 'qty', v_base)),
                      v_me, null, 'waste', p_item::text, v_approver);

  v_limit := member_rule_number(v_business, 'waste_approval_over', v_me);
  v_window := coalesce(rule_value(v_business, 'waste_approval_window') #>> '{}', 'session');
  v_today := business_local_date(v_business, now());
  v_day_start := (local_day_bounds(v_business, v_today, v_today)).from_ts;
  v_over := v_value > v_limit;
  if not v_over and v_window <> 'entry' and v_value > 0 then
    v_since := v_day_start;
    if v_window = 'session' then
      select coalesce(max(w.opened_at), v_day_start) into v_since from work_shift w
       where w.business_id = v_business and w.kind = 'session' and w.closed_at is null and w.cashier_id = v_me;
    end if;
    v_over := losses_since(v_business, v_me, null, v_since) + v_value > v_limit
              or losses_since(v_business, null, p_item, v_day_start) + v_value > v_limit;
  end if;
  if v_over and v_approver is null then
    if not coalesce(p_wait, false) then
      -- Not saying the value: whoever lacks waste.approve may also lack cost.view.
      raise exception 'This loss needs a manager''s approval: ask one to approve it now, or save it to wait for their approval';
    end if;
    v_status := 'pending';
  elsif v_approver is not null then
    v_status := 'approved';
  else
    v_status := 'not_required';
  end if;

  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                  reference_type, app_user_id, reason, approval_status)
  values (v_business, p_item, v_location, p_type, -v_base, v_cost, v_value, 'waste', v_me, trim(p_reason), v_status)
  returning id into v_mv;
  if v_value > 0 then
    v_journal := post_journal(v_business, now(), initcap(replace(p_type::text, '_', ' ')) || ': ' || trim(p_reason),
      'inventory_movement', v_mv,
      jsonb_build_array(jsonb_build_object('code', '5300', 'debit', v_value),
                        jsonb_build_object('code', '1200', 'credit', v_value)));
  end if;
  -- The manager who approved it with their PIN is kept with it.
  if v_approver is not null and v_approver <> v_me then
    insert into loss_review (business_id, movement_id, decision, decided_by)
    values (v_business, v_mv, 'approved', v_approver);
  end if;
  return jsonb_build_object('movement_id', v_mv, 'status', v_status, 'approver_id', v_approver,
    'approved_by', (select full_name from app_user where id = v_approver),
    'journal_no', (select journal_no from journal_entry where id = v_journal))
    || case when current_has_permission('cost.view') then jsonb_build_object('value', v_value) else '{}' end;
end $$;

-- 0035's record_waste, with a manager's approval or the choice to wait for one.
drop function if exists record_waste(uuid, numeric, text, movement_type, text, uuid, uuid);
create or replace function record_waste(
  p_item uuid,
  p_qty numeric,
  p_unit_code text,
  p_type movement_type,
  p_reason text,
  p_location uuid default null,
  p_approval uuid default null,
  p_wait boolean default false,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_item', p_item, 'p_qty', p_qty, 'p_unit_code', p_unit_code, 'p_type', p_type,
                                    'p_reason', p_reason, 'p_location', p_location, 'p_approval', p_approval,
                                    'p_wait', p_wait);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_waste', v_req);
  if v is not null then return v; end if;
  v := record_waste__run(p_item => p_item, p_qty => p_qty, p_unit_code => p_unit_code, p_type => p_type,
                         p_reason => p_reason, p_location => p_location, p_approval => p_approval, p_wait => p_wait);
  perform audit_event(v_business, 'inventory.waste', 'inventory_movement', v->>'movement_id', p_reason, null,
    jsonb_build_object('item', p_item, 'movement', p_type, 'qty', p_qty, 'unit', p_unit_code, 'value', v->'value',
                       'status', v->>'status', 'approved_by', v->'approver_id'));
  perform idem_finish(v_business, p_idempotency_key, 'record_waste', v_req, v);
  return v;
end $$;

-- A loss waiting for approval: a manager other than the one who recorded it
-- approves it, or reverses it because it did not happen (the stock back, and
-- its journal reversed), with a reason.
create or replace function review_loss__run(p_movement uuid, p_decision text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('waste.approve');
  v_me uuid := (current_member()).id;
  m inventory_movement; v_id uuid := gen_random_uuid(); v_journal uuid; v_rev uuid; v_rev_mv uuid;
  v_reason text := nullif(trim(p_reason), ''); v_item text; v_decision text;
begin
  if p_decision is null or p_decision not in ('approve', 'reverse') then
    raise exception 'Approve the loss, or reverse it';
  end if;
  v_decision := case p_decision when 'approve' then 'approved' else 'reversed' end;
  select * into m from inventory_movement where id = p_movement and business_id = v_business;
  if not found or not is_loss(m.type) or m.base_quantity_signed >= 0 then raise exception 'Loss not found'; end if;
  perform lock_items(array[m.item_id]);
  if exists (select 1 from loss_review where movement_id = p_movement) then
    raise exception 'This loss has been looked at already';
  end if;
  if m.approval_status <> 'pending' then raise exception 'This loss is not waiting for approval'; end if;
  if m.app_user_id = v_me then raise exception 'Someone else approves a loss you recorded'; end if;
  if p_decision = 'reverse' and v_reason is null then raise exception 'Say why the loss is reversed'; end if;
  select name into v_item from item where id = m.item_id;
  if p_decision = 'reverse' then
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason)
    values (v_business, m.item_id, m.location_id, 'reversal', -m.base_quantity_signed, m.unit_cost, m.value,
            'loss_review', v_id, v_me, 'Loss reversed: ' || v_reason)
    returning id into v_rev_mv;
    select id into v_journal from journal_entry
     where business_id = v_business and reference_type = 'inventory_movement' and reference_id = p_movement
       and reverses_entry is null and status = 'published';
    if v_journal is not null then
      v_rev := reverse_entry_internal(v_journal, now(), 'Loss reversed: ' || v_item || ': ' || v_reason);
    end if;
  end if;
  insert into loss_review (id, business_id, movement_id, decision, reason, decided_by, reversal_movement_id,
                           journal_entry_id)
  values (v_id, v_business, p_movement, v_decision, v_reason, v_me, v_rev_mv, v_rev);
  perform audit_event(v_business, case p_decision when 'approve' then 'inventory.loss_approve'
                                                  else 'inventory.loss_reverse' end,
    'inventory_movement', p_movement::text, v_reason,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', v_decision, 'item', m.item_id, 'movement', m.type,
                       'qty', -m.base_quantity_signed, 'unit', (select base_unit_code from item where id = m.item_id),
                       'value', m.value));
  return jsonb_build_object('movement_id', p_movement, 'decision', v_decision,
    'journal_no', (select journal_no from journal_entry where id = v_rev));
end $$;

create or replace function review_loss(p_movement uuid, p_decision text, p_reason text default null,
                                       p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_movement', p_movement, 'p_decision', p_decision, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'review_loss', v_req);
  if v is not null then return v; end if;
  v := review_loss__run(p_movement, p_decision, p_reason);
  perform idem_finish(v_business, p_idempotency_key, 'review_loss', v_req, v);
  return v;
end $$;

-- The losses waiting for a manager, oldest first.
create or replace function losses_waiting()
returns table (movement_id uuid, at timestamptz, item_id uuid, item text, kind text, qty numeric, unit text,
               value numeric, reason text, recorded_by_id uuid, recorded_by text)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('waste.approve'); v_cost boolean := current_has_permission('cost.view');
begin
  return query
    select m.id, m.created_at, m.item_id, i.name, m.type::text, -m.base_quantity_signed, i.base_unit_code,
           case when v_cost then m.value end, m.reason, m.app_user_id, u.full_name
      from inventory_movement m
      join item i on i.id = m.item_id
      left join app_user u on u.id = m.app_user_id
     where m.business_id = v_business and m.approval_status = 'pending' and is_loss(m.type)
       and not exists (select 1 from loss_review r where r.movement_id = m.id)
     order by m.created_at, m.id;
end $$;
-- ---------------------------------------------------------------------------
-- 7. Batches, corrections by hand, and deliveries corrected
-- ---------------------------------------------------------------------------

-- 0023's record_production (0035's __run): what a batch uses beyond the books
-- is as each ingredient's rule says, with a manager's approval when it asks.
drop function if exists record_production__run(uuid, numeric, numeric, text, text, uuid);
create or replace function record_production__run(
  p_recipe uuid, p_batches numeric default 1, p_output_qty numeric default null, p_output_unit text default null,
  p_note text default null, p_location uuid default null, p_stock_approval uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('production.record');
  v_me uuid := (current_member()).id;
  r recipe; v_today date; v_location uuid; v_planned numeric; v_actual numeric; v_unit text;
  v_batch uuid := gen_random_uuid(); v_items uuid[]; l record; v_cost numeric; v_value numeric; v_total numeric := 0;
begin
  select * into r from recipe where id = p_recipe and business_id = v_business;
  if not found or r.output_item_id is null then raise exception 'Choose what was made'; end if;
  if not r.is_active then raise exception '% is not made any more: show it again to record a batch', r.name; end if;
  if p_batches is null or p_batches <= 0 then raise exception 'Enter how many batches were made'; end if;
  v_today := business_local_date(v_business, now());
  if recipe_version_on(r.id, v_today) is null then raise exception '% has no ingredients in force today', r.name; end if;
  v_planned := trim_scale(r.batch_yield_base * p_batches);
  if p_output_qty is null then
    v_actual := v_planned;
    v_unit := r.batch_yield_unit;
  else
    v_unit := coalesce(nullif(p_output_unit, ''), (select base_unit_code from item where id = r.output_item_id));
    v_actual := to_base_qty(r.output_item_id, p_output_qty, v_unit);
    if v_actual is null or v_actual <= 0 then
      raise exception 'Enter what came out, or leave it empty if it came out as the recipe says';
    end if;
  end if;
  v_location := resolve_location(v_business, p_location);

  select array_agg(distinct e.item_id) into v_items from expand_recipe(r.id, 'dine_in', p_batches, v_today) e;
  if v_items is null then raise exception '% has no ingredients', r.name; end if;
  if r.output_item_id = any(v_items) then raise exception 'A batch cannot use what it makes'; end if;
  perform lock_items(v_items || r.output_item_id);
  -- What it uses beyond the books is as each ingredient's rule says (0040).
  perform stock_rules(v_business, v_location,
    (select jsonb_agg(jsonb_build_object('item_id', e.item_id, 'qty', e.base_qty))
       from expand_recipe(r.id, 'dine_in', p_batches, v_today) e),
    v_me, p_stock_approval, 'negative_stock', v_batch::text);

  for l in select e.item_id, sum(e.base_qty) as qty from expand_recipe(r.id, 'dine_in', p_batches, v_today) e
            group by e.item_id order by e.item_id loop
    v_cost := item_issue_cost(v_business, l.item_id, v_location);
    v_value := money_round(v_business, v_cost * l.qty);
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason)
    values (v_business, l.item_id, v_location, 'production_consumption', -l.qty, v_cost, v_value,
            'production_batch', v_batch, v_me, r.name);
    v_total := v_total + v_value;
  end loop;

  insert into production_batch (id, business_id, recipe_id, location_id, status, batches, planned_yield_base,
                                actual_yield_base, produced_at, responsible_user, quality_note, total_consumed_value,
                                output_item_id, output_unit_code)
  values (v_batch, v_business, r.id, v_location, 'completed', p_batches, v_planned, v_actual, now(), v_me,
          nullif(trim(p_note), ''), v_total, r.output_item_id, v_unit);
  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                  reference_type, reference_id, app_user_id, reason)
  values (v_business, r.output_item_id, v_location, 'production_output', v_actual, v_total / v_actual, v_total,
          'production_batch', v_batch, v_me, r.name);

  return jsonb_build_object('batch_id', v_batch, 'planned', v_planned, 'actual', v_actual)
    || case when current_has_permission('cost.view')
            then jsonb_build_object('value', v_total, 'unit_cost', v_total / v_actual) else '{}' end;
end $$;


-- 0035's record_production, passing a manager's approval of stock below zero.
drop function if exists record_production(uuid, numeric, numeric, text, text, uuid, uuid);
create or replace function record_production(
  p_recipe uuid,
  p_batches numeric DEFAULT 1,
  p_output_qty numeric DEFAULT NULL::numeric,
  p_output_unit text DEFAULT NULL::text,
  p_note text DEFAULT NULL::text,
  p_location uuid DEFAULT NULL::uuid,
  p_stock_approval uuid default null,
  p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_recipe', p_recipe, 'p_batches', p_batches, 'p_output_qty', p_output_qty, 'p_output_unit', p_output_unit, 'p_note', p_note, 'p_location', p_location, 'p_stock_approval', p_stock_approval);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'record_production', v_req);
  if v is not null then return v; end if;
  v := record_production__run(p_recipe => p_recipe, p_batches => p_batches, p_output_qty => p_output_qty, p_output_unit => p_output_unit, p_note => p_note, p_location => p_location, p_stock_approval => p_stock_approval);
  perform audit_event(v_business, 'production.record', 'production_batch', v->>'batch_id', null, null,
    jsonb_build_object('recipe', (select name from recipe where id = p_recipe), 'batches', p_batches, 'qty', p_output_qty, 'unit', p_output_unit, 'note', p_note));
  perform idem_finish(v_business, p_idempotency_key, 'record_production', v_req, v);
  return v;
end $$;


-- 0015's adjust_stock (0035's __run): below zero as the item's rule says.
create or replace function adjust_stock__run(
  p_item uuid, p_delta numeric, p_unit_code text, p_reason text,
  p_unit_cost numeric default null, p_location uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('inventory.adjust.approve');
  v_me uuid := (current_member()).id;
  v_location uuid; v_base numeric; v_cost numeric; v_value numeric; v_mv uuid; v_journal uuid; v_lines jsonb;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Say why the stock is being corrected'; end if;
  if not exists (select 1 from item where id = p_item and business_id = v_business) then raise exception 'Unknown item'; end if;
  v_base := to_base_qty(p_item, p_delta, p_unit_code);
  if v_base is null or v_base = 0 then raise exception 'The correction cannot be zero'; end if;
  v_location := resolve_location(v_business, p_location);
  perform lock_items(array[p_item]);
  -- Taking it below what the books hold is as its rule says (0040); whoever
  -- corrects stock approves that themselves.
  if v_base < 0 then
    perform stock_rules(v_business, v_location, jsonb_build_array(jsonb_build_object('item_id', p_item, 'qty', -v_base)),
                        v_me, null, 'negative_stock', p_item::text);
  end if;
  v_cost := case when v_base > 0 and p_unit_cost is not null then p_unit_cost
                 else item_issue_cost(v_business, p_item, v_location) end;
  if v_cost < 0 then raise exception 'Unit cost cannot be negative'; end if;
  v_value := money_round(v_business, v_cost * abs(v_base));
  insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                  reference_type, app_user_id, reason, approval_status)
  values (v_business, p_item, v_location, 'manual_correction', v_base, v_cost, v_value, 'adjustment', v_me,
          trim(p_reason), 'approved')
  returning id into v_mv;
  v_lines := case when v_base < 0
    then jsonb_build_array(jsonb_build_object('code', '5400', 'debit', v_value), jsonb_build_object('code', '1200', 'credit', v_value))
    else jsonb_build_array(jsonb_build_object('code', '1200', 'debit', v_value), jsonb_build_object('code', '5400', 'credit', v_value)) end;
  if v_value > 0 then
    v_journal := post_journal(v_business, now(), 'Stock correction: ' || trim(p_reason), 'inventory_movement', v_mv, v_lines);
  end if;
  perform audit_event(v_business, 'inventory.adjust', 'inventory_movement', v_mv::text, p_reason, null,
                      jsonb_build_object('item', p_item, 'delta', v_base, 'value', v_value));
  return jsonb_build_object('movement_id', v_mv, 'value', v_value,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;


-- 0038's correct_receipt__run: below zero refused where the item's rule says so.
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
-- 8. Discounts and refunds by the rules
-- ---------------------------------------------------------------------------

-- 0028's discount_approver: the cap of the giver's roles (0040).
create or replace function discount_approver(p_business uuid, p_gross numeric, p_percent numeric, p_amount numeric,
                                             p_approval uuid, p_for text) returns uuid
language plpgsql set search_path = public as $$
declare v_cap numeric; v_pct numeric; a approval;
begin
  if p_percent is null and p_amount is null then return null; end if;
  if current_has_permission('discount.approve') then return null; end if;
  v_cap := member_rule_number(p_business, 'discount_cap_percent', (current_member()).id);
  v_pct := discount_share(p_gross, p_percent, p_amount);
  if v_pct <= v_cap then return null; end if;
  if p_approval is null then
    raise exception '%', format('A discount over %s%% needs a manager''s approval', trim_scale(v_cap));
  end if;
  a := use_approval(p_business, p_approval, 'discount', p_for);
  if coalesce((a.scope ->> 'percent')::numeric, 0) < v_pct then
    raise exception '%', format('The manager approved up to %s%%: ask again for this one',
                                trim_scale(coalesce((a.scope ->> 'percent')::numeric, 0)));
  end if;
  return a.approver_id;
end $$;


-- 0028's save_tab (0035's __run): the cap of whoever gave the discount (0040).
create or replace function save_tab__run(p_tab uuid, p_version int, p_lines jsonb, p_label text default null,
                                    p_table uuid default null, p_discount_percent numeric default null,
                                    p_discount_amount numeric default null, p_discount_reason text default null,
                                    p_discount_note text default null, p_approval uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('sale.create');
  v_me uuid := (current_member()).id;
  t pos_tab; l jsonb; i int := 0; v_before jsonb; v_today date; v_was jsonb; v_now jsonb; v_frozen jsonb;
  v_gross numeric := 0; v_price numeric; v_reduced boolean;
  v_disc_by uuid; v_disc_approved uuid; v_disc_reason text; v_share numeric; v_allowed numeric;
begin
  t := lock_open_tab(v_business, p_tab, p_version);
  v_today := business_local_date(v_business, now());
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then raise exception 'The bill has no lines'; end if;
  -- What the customer was shown keeps its printed price (0025); anything not
  -- yet printed is priced when the bill is printed, or paid.
  select coalesce(jsonb_object_agg(v, p), '{}'::jsonb) into v_frozen
    from (select product_variant_id::text v, min(unit_price) p from pos_tab_line
           where tab_id = p_tab and unit_price is not null group by 1) x;
  for l in select * from jsonb_array_elements(p_lines) loop
    if coalesce((l ->> 'qty')::numeric, 0) <= 0 then raise exception 'Each line needs a positive quantity'; end if;
    if not exists (select 1 from product_variant pv join product p on p.id = pv.product_id
                    where pv.id = (l ->> 'variant_id')::uuid and pv.business_id = v_business
                      and pv.is_active and p.is_active) then
      raise exception 'A product on the bill is not on sale';
    end if;
    -- Refused now, not when the customer comes to pay.
    v_price := coalesce((v_frozen ->> (l ->> 'variant_id'))::numeric,
                        price_on((l ->> 'variant_id')::uuid, t.channel, t.location_id, v_today));
    if v_price is null then
      raise exception 'No % price is set for %', t.channel,
        (select p.name from product_variant pv join product p on p.id = pv.product_id
          where pv.id = (l ->> 'variant_id')::uuid);
    end if;
    v_gross := v_gross + money_round(v_business, v_price * (l ->> 'qty')::numeric);
  end loop;
  if p_table is not null and p_table is distinct from t.table_id
     and not exists (select 1 from dining_table where id = p_table and business_id = v_business
                       and is_active and location_id = t.location_id) then
    raise exception 'That table is not in use';
  end if;

  -- A discount is given only by someone allowed to, with its reason, and above
  -- the cap with a manager's approval (0028). Once the customer has seen the
  -- bill, changing it is a manager's call; taking it off never is.
  v_disc_by := t.discount_by; v_disc_approved := t.discount_approved_by; v_disc_reason := t.discount_reason;
  v_was := jsonb_build_object('percent', t.discount_percent, 'amount', t.discount_amount);
  v_now := jsonb_build_object('percent', p_discount_percent, 'amount', p_discount_amount);
  if v_now is distinct from v_was then
    if p_discount_percent is not null or p_discount_amount is not null then
      if not current_has_permission('discount.apply') then
        raise exception 'You do not have permission to give discounts' using errcode = '42501';
      end if;
      perform sale_discount(v_business, 0, p_discount_percent, p_discount_amount);
      if t.bill_printed_at is not null and not current_has_permission('sale.void') then
        raise exception 'Only a manager can change the discount on a bill that has been printed' using errcode = '42501';
      end if;
      v_disc_reason := reason_text('discount', p_discount_reason, p_discount_note);
      v_disc_approved := discount_approver(v_business, v_gross, p_discount_percent, p_discount_amount,
                                           p_approval, p_tab::text);
      v_disc_by := v_me;
    else
      v_disc_by := null; v_disc_approved := null; v_disc_reason := null;
    end if;
    if t.bill_printed_at is not null or t.discount_percent is not null or t.discount_amount is not null then
      perform audit_event(v_business, 'bill.discount', 'pos_tab', p_tab::text, v_disc_reason, v_was,
                          v_now || jsonb_build_object('approved_by', v_disc_approved));
    end if;
  elsif p_discount_amount is not null and not current_has_permission('discount.approve') then
    -- An amount stays as it was given while the bill changes: taking things
    -- off must not make it more of the bill than the cap, or than a manager
    -- approved (a manager's own discount is theirs, whatever the bill).
    v_share := discount_share(v_gross, null, p_discount_amount);
    v_allowed := member_rule_number(v_business, 'discount_cap_percent', coalesce(t.discount_by, v_me));
    if t.discount_approved_by is not null then
      v_allowed := greatest(v_allowed, coalesce((
        select (a.scope ->> 'percent')::numeric from approval a
         where a.business_id = v_business and a.kind = 'discount' and a.used_for = p_tab::text
           and a.approver_id = t.discount_approved_by
         order by a.used_at desc limit 1), 0));
    elsif t.discount_by is not null and member_has_permission(t.discount_by, 'discount.approve') then
      v_allowed := 100;
    end if;
    if v_share > v_allowed then
      raise exception '%', format('The %s off would be %s%% of the bill, over the %s%% allowed: take the discount off first, or ask a manager',
        trim_scale(p_discount_amount), trim_scale(v_share), trim_scale(v_allowed));
    end if;
  end if;

  -- Anything taken off the bill is recorded; once the customer has seen it,
  -- taking anything off is a manager's call.
  select exists (
       select 1
         from (select product_variant_id v, sum(qty) q from pos_tab_line where tab_id = p_tab group by 1) was
         left join (select (x ->> 'variant_id')::uuid v, sum((x ->> 'qty')::numeric) q
                      from jsonb_array_elements(p_lines) x group by 1) now_ on now_.v = was.v
        where coalesce(now_.q, 0) < was.q) into v_reduced;
  if v_reduced then
    if t.bill_printed_at is not null and not current_has_permission('sale.void') then
      raise exception 'Only a manager can take items off a bill that has been printed' using errcode = '42501';
    end if;
    select jsonb_agg(jsonb_build_object('variant_id', product_variant_id, 'qty', qty) order by position)
      into v_before from pos_tab_line where tab_id = p_tab;
    perform audit_event(v_business, case when t.bill_printed_at is not null then 'bill.reduce' else 'bill.line_remove' end,
                        'pos_tab', p_tab::text, null,
                        jsonb_build_object('lines', v_before), jsonb_build_object('lines', p_lines));
  end if;

  delete from pos_tab_line where tab_id = p_tab;
  for l in select * from jsonb_array_elements(p_lines) loop
    i := i + 1;
    insert into pos_tab_line (tab_id, business_id, product_variant_id, qty, note, position, added_by, unit_price)
    values (p_tab, v_business, (l ->> 'variant_id')::uuid, (l ->> 'qty')::numeric,
            left(nullif(trim(l ->> 'note'), ''), 200), i, v_me, (v_frozen ->> (l ->> 'variant_id'))::numeric);
  end loop;
  update pos_tab
     set version = version + 1,
         label = coalesce(nullif(trim(p_label), ''), label),
         table_id = coalesce(p_table, table_id),
         discount_percent = p_discount_percent,
         discount_amount = p_discount_amount,
         discount_by = v_disc_by,
         discount_approved_by = v_disc_approved,
         discount_reason = v_disc_reason
   where id = p_tab;
  return jsonb_build_object('tab_id', p_tab, 'version', t.version + 1);
end $$;


-- 0028's report_exceptions: each discount against its giver's cap (0040).
create or replace function report_exceptions(p_from date, p_to date)
returns table (at timestamptz, kind text, person_id uuid, person text, amount numeric, reason text,
               approved_by text, needs_review boolean, reference text, detail text)
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('audit.view'); b record;
begin
  select * into b from local_day_bounds(v_business, p_from, p_to);
  return query
    select sa.created_at, sa.kind::text, sa.requested_by, rq.full_name, sa.amount, sa.reason,
           case when sa.approved_by is distinct from sa.requested_by then ap.full_name end,
           sa.approved_by is null or sa.approved_by = sa.requested_by,
           'Sale ' || left(o.id::text, 8),
           'Rung by ' || coalesce(ca.full_name, 'someone') ||
             case when o.cashier_id = sa.requested_by then ' (their own sale)' else '' end
      from sale_adjustment sa
      join sales_order o on o.id = sa.sales_order_id
      left join app_user rq on rq.id = sa.requested_by
      left join app_user ap on ap.id = sa.approved_by
      left join app_user ca on ca.id = o.cashier_id
     where sa.business_id = v_business and sa.kind in ('void', 'refund')
       and sa.created_at >= b.from_ts and sa.created_at < b.to_ts
    union all
    select o.placed_at, 'discount', coalesce(o.discount_by, o.cashier_id), gv.full_name, o.discount_amount,
           coalesce(o.discount_reason, 'No reason kept (given before reasons were asked)'), dap.full_name,
           o.discount_reason is null and o.discount_approved_by is null
             and discount_share(o.gross_amount, o.discount_percent, o.discount_amount)
                 > member_rule_number(v_business, 'discount_cap_percent', coalesce(o.discount_by, o.cashier_id))
             and not member_has_permission(coalesce(o.discount_by, o.cashier_id), 'discount.approve'),
           'Sale ' || left(o.id::text, 8),
           coalesce(trim_scale(o.discount_percent) || '% asked, ', '')
             || trim_scale(round(o.discount_amount / nullif(o.gross_amount, 0) * 100, 1)) || '% of '
             || trim_scale(o.gross_amount)
             || case when o.discount_by is null then ', given before who gave it was kept' else '' end
             || case when o.status = 'voided' then ', later voided'
                     when o.status = 'refunded' then ', later refunded' else '' end
      from sales_order o
      left join app_user gv on gv.id = coalesce(o.discount_by, o.cashier_id)
      left join app_user dap on dap.id = o.discount_approved_by
     where o.business_id = v_business and o.discount_amount > 0 and o.status <> 'open'
       and o.placed_at >= b.from_ts and o.placed_at < b.to_ts
    union all
    select a.occurred_at,
           case a.action when 'bill.cancel' then 'bill_cancel' when 'bill.reduce' then 'printed_bill_reduced'
                         when 'bill.line_remove' then 'line_removed' else 'wrong_pin' end,
           a.app_user_id, u.full_name, null::numeric, a.reason, null::text,
           a.action = 'approval.refused',
           case when a.action = 'approval.refused' then 'Approval by ' || coalesce(ap.full_name, 'someone')
                else 'Bill ' || left(a.entity_id, 8) end,
           case when a.action = 'bill.cancel'
                  then coalesce(jsonb_array_length(a.before_state -> 'lines'), 0) || ' line(s) on it'
                when a.action in ('bill.reduce', 'bill.line_remove')
                  then (select coalesce(sum(greatest(bq.q - coalesce(nq.q, 0), 0)), 0)
                          from (select x ->> 'variant_id' v, sum((x ->> 'qty')::numeric) q
                                  from jsonb_array_elements(a.before_state -> 'lines') x group by 1) bq
                          left join (select x ->> 'variant_id' v, sum((x ->> 'qty')::numeric) q
                                       from jsonb_array_elements(a.after_state -> 'lines') x group by 1) nq
                            on nq.v = bq.v) || ' item(s) taken off'
                else a.after_state ->> 'kind' end
      from audit_log a
      left join app_user u on u.id = a.app_user_id
      left join app_user ap on ap.id::text = a.entity_id and a.action = 'approval.refused'
     where a.business_id = v_business
       and (a.action in ('bill.reduce', 'bill.line_remove', 'approval.refused')
            or (a.action = 'bill.cancel' and jsonb_typeof(a.before_state -> 'lines') = 'array'))
       and a.occurred_at >= b.from_ts and a.occurred_at < b.to_ts
     order by 1;
end $$;


-- 0028's my_profile: the rules as they apply to the person (0040).
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
                              where ur.app_user_id = m.id), '[]'))
  end
  from (select * from app_user where auth_user_id = auth.uid() and is_active limit 1) m
  right join (select 1) one on true
$$;


-- 0020's sale_discount: the step on Settings → Rules (0040).
create or replace function sale_discount(p_business uuid, p_gross numeric, p_percent numeric, p_amount numeric)
returns numeric language plpgsql stable set search_path = public as $$
declare v_step numeric;
begin
  if p_percent is not null and p_amount is not null then
    raise exception 'Give the discount as a percentage or as an amount, not both';
  end if;
  if p_percent is not null then
    if p_percent <= 0 or p_percent > 100 then
      raise exception 'A discount is more than 0%% and no more than 100%%';
    end if;
    v_step := (rule_value(p_business, 'discount_round_to') #>> '{}')::numeric;
    if v_step is null then raise exception 'Business not found'; end if;
    return least(money_round(p_business, floor(p_gross * p_percent / 100 / v_step + 0.5) * v_step),
                 greatest(p_gross, 0));
  end if;
  if p_amount is not null then
    if p_amount <= 0 then raise exception 'A discount must be more than zero'; end if;
    return least(money_round(p_business, p_amount), greatest(p_gross, 0));
  end if;
  return 0;
end $$;


-- 0037's refund_lines_internal: a refund over the limit needs a second person (0040).
create or replace function refund_lines_internal(p_business uuid, p_me uuid, p_order uuid, p_lines jsonb,
                                                 p_reason_code text, p_reason text, p_approval uuid)
returns jsonb language plpgsql set search_path = public as $$
declare
  o sales_order; v_tender tender_type; v_paid numeric; v_reason text; v_code text;
  v_approver uuid := p_me; a approval; v_id uuid := gen_random_uuid(); v_no bigint;
  v_has_lines boolean; v_legacy boolean; l record; it record;
  v_left numeric; v_left_amount numeric; v_want numeric; v_line_amount numeric; v_line_cost numeric;
  v_restocked boolean; v_q numeric; v_v numeric; v_rest boolean := false;
  v_plan jsonb := '[]'; v_moves jsonb := '[]'; v_amount numeric := 0; v_cost numeric := 0;
  v_journal uuid; v_status order_status; p jsonb; v_items text; v_before numeric;
begin
  select * into o from sales_order where id = p_order and business_id = p_business for update;
  if not found then raise exception 'Sale not found'; end if;
  if o.status = 'refunded' then raise exception 'This sale has been refunded in full already'; end if;
  if o.status = 'voided' then raise exception 'This sale was voided: there is nothing to refund'; end if;
  if o.status not in ('completed', 'partially_refunded') then
    raise exception 'Only a completed sale can be refunded; this one is %', o.status;
  end if;
  select tender_type, amount into v_tender, v_paid from sales_tender where sales_order_id = p_order
   order by id limit 1;
  if tender_account(v_tender) is null then raise exception 'This sale''s tender cannot be refunded here'; end if;
  v_reason := reason_text('refund', p_reason_code, p_reason);
  v_code := coalesce(nullif(trim(p_reason_code), ''), 'other');
  if p_approval is not null then
    a := use_approval(p_business, p_approval, 'refund', p_order::text);
    if a.scope ->> 'order_id' is distinct from p_order::text then
      raise exception 'That approval is for another sale';
    end if;
    v_approver := a.approver_id;
  end if;

  if p_lines is not null then
    if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
      raise exception 'Choose what to refund';
    end if;
    if exists (select 1 from jsonb_array_elements(p_lines) x
                where jsonb_typeof(x) <> 'object'
                   or coalesce(x ->> 'line_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                   or coalesce(x ->> 'qty', '') !~ '^[0-9]+(\.[0-9]+)?$') then
      raise exception 'The items to refund cannot be read';
    end if;
    if exists (select 1 from jsonb_array_elements(p_lines) x
                where not exists (select 1 from sales_order_line sl
                                   where sl.id = (x ->> 'line_id')::uuid and sl.sales_order_id = p_order)) then
      raise exception 'That item is not on this sale';
    end if;
    if (select count(*) from jsonb_array_elements(p_lines)) <>
       (select count(distinct x ->> 'line_id') from jsonb_array_elements(p_lines) x) then
      raise exception 'An item is named twice';
    end if;
  end if;

  v_has_lines := exists (select 1 from sales_order_line where sales_order_id = p_order);
  -- Recorded before 0037: its stock movements do not name its lines.
  v_legacy := not v_has_lines
              or exists (select 1 from inventory_movement mv
                          where mv.reference_type = 'sales_order' and mv.reference_id = p_order
                            and mv.type = 'sale_consumption' and mv.sales_order_line_id is null);

  for l in
    select sl.id, sl.quantity, sl.line_net, coalesce(nullif(sl.product_name, ''), pr.name, pv.name) as name,
           coalesce((select sum(rl.qty) from sale_refund_line rl where rl.sales_order_line_id = sl.id), 0) as done_qty,
           coalesce((select sum(rl.amount) from sale_refund_line rl where rl.sales_order_line_id = sl.id), 0)
             as done_amount,
           (select (x ->> 'qty')::numeric from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) x
             where (x ->> 'line_id')::uuid = sl.id) as asked
      from sales_order_line sl
      left join product_variant pv on pv.id = sl.product_variant_id
      left join product pr on pr.id = pv.product_id
     where sl.sales_order_id = p_order
     order by sl.id
  loop
    v_left := l.quantity - l.done_qty;
    v_left_amount := l.line_net - l.done_amount;
    v_want := case when p_lines is null then v_left else coalesce(l.asked, 0) end;
    if v_want > v_left then
      raise exception 'Only % of % is left to refund', trim_scale(v_left), l.name;
    end if;
    if v_want > 0 then
      v_line_amount := case when v_want = v_left then v_left_amount
                            else least(v_left_amount, money_round(p_business, l.line_net * v_want / l.quantity)) end;
      v_line_cost := 0;
      v_restocked := false;
      if not v_legacy then
        -- The line's own stock that can go back on the shelf, in proportion:
        -- what it took, less what earlier refunds of it gave back.
        for it in
          select mv.item_id, -sum(mv.base_quantity_signed) as sold_q, coalesce(sum(mv.value), 0) as sold_v,
                 coalesce((select sum(r.base_quantity_signed) from inventory_movement r
                            where r.sales_order_line_id = l.id and r.item_id = mv.item_id
                              and r.type = 'refund_return_to_stock'), 0) as back_q,
                 coalesce((select sum(r.value) from inventory_movement r
                            where r.sales_order_line_id = l.id and r.item_id = mv.item_id
                              and r.type = 'refund_return_to_stock'), 0) as back_v
            from inventory_movement mv join item i on i.id = mv.item_id
           where mv.sales_order_line_id = l.id and mv.type = 'sale_consumption' and i.returnable_to_stock
           group by mv.item_id
           order by mv.item_id
        loop
          if v_want = v_left then
            v_q := it.sold_q - it.back_q;
            v_v := it.sold_v - it.back_v;
          else
            v_q := round(it.sold_q * v_want / l.quantity, 6);
            v_v := least(it.sold_v - it.back_v, money_round(p_business, it.sold_v * v_want / l.quantity));
          end if;
          if v_q > 0 then
            v_moves := v_moves || jsonb_build_object('line_id', l.id, 'item_id', it.item_id, 'qty', v_q, 'value', v_v);
            v_line_cost := v_line_cost + v_v;
            v_restocked := true;
          end if;
        end loop;
      end if;
      v_plan := v_plan || jsonb_build_object('line_id', l.id, 'name', l.name, 'qty', v_want, 'amount', v_line_amount,
                                             'cost_returned', v_line_cost, 'restocked', v_restocked);
      v_amount := v_amount + v_line_amount;
      v_cost := v_cost + v_line_cost;
    end if;
    if v_left - v_want > 0 then v_rest := true; end if;
  end loop;

  if v_legacy then
    -- Refunded whole, as before 0037: every movement of the sale's that can
    -- go back on the shelf does.
    if v_rest then raise exception 'This sale was recorded before refunds by item: refund all of it'; end if;
    for it in
      select mv.item_id, -mv.base_quantity_signed as q, coalesce(mv.value, 0) as v
        from inventory_movement mv join item i on i.id = mv.item_id
       where mv.reference_type = 'sales_order' and mv.reference_id = p_order
         and mv.type = 'sale_consumption' and i.returnable_to_stock
       order by mv.id
    loop
      v_moves := v_moves || jsonb_build_object('line_id', null, 'item_id', it.item_id, 'qty', it.q, 'value', it.v);
      v_cost := v_cost + it.v;
    end loop;
    if not v_has_lines then v_amount := o.net_amount - sale_refunded(p_order); end if;
  elsif jsonb_array_length(v_plan) = 0 then
    raise exception 'Choose what to refund';
  end if;
  if v_amount <= 0 then
    raise exception 'The items chosen were sold for nothing: there is no money to give back';
  end if;
  v_before := sale_refunded(p_order);
  if v_amount > v_paid - v_before then
    raise exception 'This refund is more than is left of what was paid (%)', trim_scale(v_paid - v_before);
  end if;
  -- Over the limit of the refunder's roles, a second person approves it (0040).
  if p_approval is null and v_amount > member_rule_number(p_business, 'refund_approval_over', p_me) then
    raise exception 'A refund over % needs a second person to approve it',
      alert_money(member_rule_number(p_business, 'refund_approval_over', p_me));
  end if;

  -- The adjustment first: a cash refund leaves the drawer's open session,
  -- which must hold it.
  insert into sale_adjustment (id, business_id, sales_order_id, kind, amount, reason, reason_code, requested_by,
                               approved_by)
  values (v_id, p_business, p_order, 'refund', v_amount, v_reason, v_code, p_me, v_approver);
  v_no := next_document_no(p_business, 'refund', 1);
  if jsonb_array_length(v_moves) > 0 then
    perform lock_items(array(select distinct (x ->> 'item_id')::uuid from jsonb_array_elements(v_moves) x));
  end if;
  v_journal := post_journal(p_business, now(),
    'Refund ' || v_no || ' of sale ' || left(p_order::text, 8) || ': ' || v_reason, 'sale_refund', v_id,
    jsonb_build_array(
      jsonb_build_object('code', '4200', 'debit', v_amount),
      jsonb_build_object('code', tender_account(v_tender), 'credit', v_amount),
      jsonb_build_object('code', '1200', 'debit', v_cost),
      jsonb_build_object('code', '5000', 'credit', v_cost)));
  insert into sale_refund (id, business_id, refund_no, sales_order_id, location_id, work_shift_id, amount,
                           cost_returned, reason_code, reason, requested_by, approved_by, approval_id,
                           journal_entry_id, whole)
  values (v_id, p_business, v_no, p_order, o.location_id, open_session_at(p_business, o.location_id), v_amount,
          v_cost, v_code, v_reason, p_me, v_approver, p_approval, v_journal, not v_rest);
  for p in select * from jsonb_array_elements(v_plan) loop
    insert into sale_refund_line (business_id, refund_id, sales_order_line_id, qty, amount, cost_returned, restocked)
    values (p_business, v_id, (p ->> 'line_id')::uuid, (p ->> 'qty')::numeric, (p ->> 'amount')::numeric,
            (p ->> 'cost_returned')::numeric, (p ->> 'restocked')::boolean);
  end loop;
  insert into sale_refund_tender (business_id, refund_id, tender_type, amount)
  values (p_business, v_id, v_tender, v_amount);
  for p in select * from jsonb_array_elements(v_moves) loop
    insert into inventory_movement (business_id, item_id, location_id, type, base_quantity_signed, unit_cost, value,
                                    reference_type, reference_id, app_user_id, reason, sales_order_line_id)
    values (p_business, (p ->> 'item_id')::uuid, o.location_id, 'refund_return_to_stock', (p ->> 'qty')::numeric,
            (p ->> 'value')::numeric / (p ->> 'qty')::numeric, (p ->> 'value')::numeric,
            'sale_refund', v_id, p_me, 'Refund: ' || v_reason, (p ->> 'line_id')::uuid);
  end loop;

  v_status := case when v_rest then 'partially_refunded' else 'refunded' end::order_status;
  if v_status is distinct from o.status then
    update sales_order set status = v_status where id = p_order;
  end if;
  select string_agg((x ->> 'name') || ' ×' || trim_scale((x ->> 'qty')::numeric), ', ')
    into v_items from jsonb_array_elements(v_plan) x;
  perform audit_event(p_business, 'sale.refund', 'sales_order', p_order::text, v_reason,
    jsonb_build_object('status', o.status, 'net', o.net_amount, 'refunded', v_before),
    jsonb_build_object('status', v_status, 'refund_no', v_no, 'refunded', v_before + v_amount,
                       'amount', v_amount, 'items', v_items, 'returned_to_stock', v_cost,
                       'approved_by', v_approver));
  return jsonb_build_object('order_id', p_order, 'refund_id', v_id, 'refund_no', v_no, 'refunded', v_amount,
    'returned_to_stock', v_cost, 'tender', v_tender, 'status', v_status, 'whole', not v_rest, 'lines', v_plan,
    'journal_no', (select journal_no from journal_entry where id = v_journal));
end $$;

-- ---------------------------------------------------------------------------
-- 9. A reversed loss, on the stock card and in the usage, is a loss taken back
-- ---------------------------------------------------------------------------
-- 0038's stock_card_kind.
create or replace function stock_card_kind(p_type movement_type, p_reference text, p_qty numeric) returns text
language sql immutable set search_path = public as $$
  select case
    when p_type = 'opening_balance' then 'opening_stock'
    when p_type in ('purchase_receipt', 'supplier_return') then 'received'
    when p_type::text = 'receipt_correction' then 'received'
    when p_type::text = 'cost_adjustment' then 'revalued'
    when p_type in ('sale_consumption', 'refund_return_to_stock') then 'sold'
    when p_type = 'reversal' and p_reference in ('sale_void', 'sales_order') then 'sold'
    when p_type = 'production_consumption' then 'batches'
    when p_type = 'reversal' and p_reference = 'production_cancel' and p_qty > 0 then 'batches'
    when p_type = 'production_output' then 'made'
    when p_type = 'reversal' and p_reference = 'production_cancel' then 'made'
    when p_type in ('waste', 'spoilage', 'melt_evaporation', 'staff_consumption', 'complimentary', 'sampling',
                    'damaged', 'expired') then 'wasted'
    when p_type = 'reversal' and p_reference = 'loss_review' then 'wasted'
    when p_type = 'count_adjustment' then 'counted'
    when p_type in ('transfer_in', 'transfer_out') then 'transferred'
    else 'corrected'
  end
$$;

-- ---------------------------------------------------------------------------
-- 10. The alerts: stock below zero, and losses waiting for a manager
-- ---------------------------------------------------------------------------
-- 0039's rules stay as they are; these two follow.
alter function alert_conditions(uuid, timestamptz) rename to alert_conditions_0039;
revoke execute on function alert_conditions_0039(uuid, timestamptz) from public, anon, authenticated;

create or replace function alert_conditions(p_business uuid, p_now timestamptz)
returns table (rule text, subject text, urgency text, title text, why text, action text, confidence text,
               link text, facts jsonb)
language plpgsql stable set search_path = public as $$
begin
  return query
    select c.rule, c.subject, c.urgency, c.title, c.why, c.action, c.confidence, c.link, c.facts
      from alert_conditions_0039(p_business, p_now) c;

  -- An item the books hold less than nothing of, unless its rule allows that
  -- without an alert.
  return query
    select 'stock_below_zero'::text, p.location_id || ':' || p.item_id, 'red'::text,
           format('%s is below zero in the books: %s %s', i.name, alert_qty(p.qty), i.base_unit_code),
           'Stock cannot be less than nothing: a delivery or a batch was not entered, or more was used than was recorded.'::text,
           'Enter the delivery or the batch that is missing, or count the item on Stock Count.'::text,
           'high'::text, '/inventory/' || i.id,
           jsonb_build_object('item_id', i.id, 'location_id', p.location_id, 'qty', p.qty)
      from (select m.item_id, m.location_id, sum(m.base_quantity_signed) as qty
              from inventory_movement m
             where m.business_id = p_business and m.created_at <= p_now
             group by m.item_id, m.location_id
            having sum(m.base_quantity_signed) < 0) p
      join item i on i.id = p.item_id
     where coalesce(rule_value(p_business, 'negative_stock', i.id) #>> '{}', 'alert') <> 'allow'
     order by i.name;

  -- Losses saved to wait for a manager's approval: red once one has waited two days.
  return query
    select 'losses_waiting'::text, (array_agg(m.id order by m.created_at, m.id))[1]::text,
           (case when min(m.created_at) < p_now - interval '2 days' then 'red' else 'orange' end)::text,
           format('%s loss(es) waiting for a manager''s approval (%s IQD)', count(*), alert_money(sum(m.value))),
           'A loss over the limit was saved to wait for a manager: until one approves it, or reverses it, nobody has looked at it.'::text,
           'Open Inventory: approve each loss, or reverse one that did not happen.'::text,
           'high'::text, '/inventory#losses-waiting'::text,
           jsonb_build_object('count', count(*), 'value', sum(m.value), 'since', min(m.created_at))
      from inventory_movement m
     where m.business_id = p_business and m.approval_status = 'pending' and is_loss(m.type)
       and m.created_at <= p_now
       and not exists (select 1 from loss_review r where r.movement_id = m.id)
    having count(*) > 0;
end $$;
-- ---------------------------------------------------------------------------
-- 11. Who may call what
-- ---------------------------------------------------------------------------
revoke execute on function
  rule_definitions(), rule_defaults(uuid), rule_rows(uuid, text), rule_value(uuid, text, uuid, app_role[], uuid),
  member_rule_number(uuid, text, uuid), set_business_rule__run(text, text, text, jsonb, text), business_rule_write(),
  stock_shortfalls(uuid, uuid, jsonb), stock_rules(uuid, uuid, jsonb, uuid, uuid, text, text, uuid),
  is_loss(movement_type), losses_since(uuid, uuid, uuid, timestamptz),
  post_sale(uuid, uuid, uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, boolean, jsonb, int, uuid),
  record_waste__run(uuid, numeric, text, movement_type, text, uuid, uuid, boolean),
  review_loss__run(uuid, text, text),
  record_production__run(uuid, numeric, numeric, text, text, uuid, uuid),
  alert_conditions(uuid, timestamptz)
  from public, anon, authenticated;
revoke execute on function
  set_business_rule(text, text, text, jsonb, text, uuid), list_business_rules(),
  review_loss(uuid, text, text, uuid), losses_waiting(),
  record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid, text, uuid),
  settle_tab(uuid, int, uuid, tender_type, numeric, uuid),
  record_waste(uuid, numeric, text, movement_type, text, uuid, uuid, boolean, uuid),
  record_production(uuid, numeric, numeric, text, text, uuid, uuid, uuid)
  from public, anon;
grant execute on function
  set_business_rule(text, text, text, jsonb, text, uuid), list_business_rules(),
  review_loss(uuid, text, text, uuid), losses_waiting(),
  record_sale(uuid, sales_channel, tender_type, jsonb, uuid, numeric, numeric, numeric, text, text, uuid, text, uuid),
  settle_tab(uuid, int, uuid, tender_type, numeric, uuid),
  record_waste(uuid, numeric, text, movement_type, text, uuid, uuid, boolean, uuid),
  record_production(uuid, numeric, numeric, text, text, uuid, uuid, uuid)
  to authenticated;
