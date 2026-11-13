-- 0108: plans, parts and the type of business (plan 10, step 1; the selling
-- plan's "plans for small and big cafés"). The owner (12 November): agreed.
--
-- One system for every business, parts switched on or off, never a version
-- for one customer:
--   * Each business has a type (café, bakery, restaurant, supplier), chosen at
--     setup, deciding which parts are on by default, and a plan (Starter,
--     Complete, Business), deciding which parts it may have at all and how
--     many places.
--   * The parts: the till; stock, counts, daily reports, help and practice
--     (always); recipes and costing with production and use-by; purchasing and
--     suppliers; staff, the clock and payroll; the full accounting screens;
--     customers on account; and several places (branches, a central kitchen,
--     transfers). Later steps add their own parts here, switched off.
--   * A part that is off is off in two places: the screens do not show it, and
--     the database refuses its work, in the same place it refuses a cashier a
--     manager's work (current_has_permission). The books still run underneath:
--     every sale, delivery and count posts its journals whatever the plan, so
--     turning a part on shows its whole history.
--   * The owner switches a part on or off within the plan, with a reason; the
--     system's administrators change a business's plan.
--
-- Every business already here is a café on the Business plan with every part
-- on: nothing changes for it.

alter table business add column if not exists business_type text not null default 'cafe';
alter table business add column if not exists plan text not null default 'business';
alter table business drop constraint if exists business_type_ok;
alter table business add constraint business_type_ok
  check (business_type in ('cafe', 'bakery', 'restaurant', 'supplier'));
alter table business drop constraint if exists business_plan_ok;
alter table business add constraint business_plan_ok check (plan in ('starter', 'complete', 'business'));

-- The parts, what each plan includes, and which types have them on by default.
create or replace function part_catalogue() returns jsonb
language sql immutable set search_path = public as $$
  select '{
    "till":       {"label": "The till: menu, tables, open bills, offline sales",
                   "plans": ["starter", "complete", "business"], "on_for": ["cafe", "bakery", "restaurant"]},
    "recipes":    {"label": "Recipes and costing, production and use-by",
                   "plans": ["complete", "business"], "on_for": ["cafe", "bakery", "restaurant", "supplier"]},
    "purchasing": {"label": "Purchasing and suppliers",
                   "plans": ["complete", "business"], "on_for": ["cafe", "bakery", "restaurant", "supplier"]},
    "staff":      {"label": "Staff, the clock and payroll",
                   "plans": ["complete", "business"], "on_for": ["cafe", "bakery", "restaurant", "supplier"]},
    "accounting": {"label": "The full accounting screens: journals, the bank, the balance sheet",
                   "plans": ["complete", "business"], "on_for": ["cafe", "bakery", "restaurant", "supplier"]},
    "wholesale":  {"label": "Customers on account: invoices, terms and payments",
                   "plans": ["complete", "business"], "on_for": ["cafe", "bakery", "restaurant", "supplier"]},
    "branches":   {"label": "Several places: branches, a central kitchen, transfers",
                   "plans": ["business"], "on_for": ["cafe", "bakery", "restaurant", "supplier"]}
  }'::jsonb
$$;

-- The permission each part's work needs; null: the core, always on.
create or replace function permission_part(p_permission text) returns text
language sql immutable set search_path = public as $$
  select case
    when p_permission in ('sale.create', 'sale.void', 'sale.refund', 'discount.apply', 'discount.approve') then 'till'
    when p_permission in ('recipe.edit', 'production.record') then 'recipes'
    when p_permission in ('purchase.create', 'purchase.receive', 'purchase.approve') then 'purchasing'
    when p_permission in ('payroll.run', 'payroll.view', 'attendance.edit', 'staff.manage') then 'staff'
    when p_permission in ('accounting.post', 'accounting.period.lock', 'accounting.period.unlock') then 'accounting'
    when p_permission in ('credit.manage') then 'wholesale'
    when p_permission in ('stock.transfer') then 'branches'
  end
$$;

-- The owner's own switch for a part, within the plan.
create table if not exists business_part (
  business_id uuid not null references business(id) on delete cascade,
  part        text not null,
  enabled     boolean not null,
  reason      text,
  set_by      uuid references app_user(id),
  set_at      timestamptz not null default now(),
  primary key (business_id, part)
);
alter table business_part enable row level security;
alter table business_part force row level security;

-- Every business here keeps every part, as before.
insert into business_part (business_id, part, enabled, reason)
select b.id, k, true, 'On before plans and parts (0108)'
  from business b cross join jsonb_object_keys(part_catalogue()) k
on conflict do nothing;

-- Whether a part is on for a business: in its plan, and on (its own switch,
-- else its type's default).
create or replace function part_on(p_business uuid, p_part text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when not (part_catalogue() -> p_part -> 'plans') ? b.plan then false
      else coalesce((select bp.enabled from business_part bp where bp.business_id = b.id and bp.part = p_part),
                    (part_catalogue() -> p_part -> 'on_for') ? b.business_type)
    end
      from business b where b.id = p_business), true)
$$;

-- 0096's current_has_permission: a permission whose part is off is not held (0108).
create or replace function current_has_permission(p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select not two_step_pending() and exists (
    select 1 from user_role ur join role_permission rp on rp.role = ur.role
     where ur.app_user_id = session_member_id() and rp.permission = p_permission)
    and (permission_part(p_permission) is null
         or part_on((select business_id from app_user where id = session_member_id()), permission_part(p_permission)))
$$;

-- 0080's require_permission: a part that is off says so (0108).
create or replace function require_permission(variadic p_any text[]) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare m app_user; p text; v_off text;
begin
  m := current_member();
  if m.id is null then
    raise exception 'Sign in to continue' using errcode = '28000';
  end if;
  if two_step_pending() then
    raise exception 'Finish signing in: type the code from your authenticator app' using errcode = '28000';
  end if;
  foreach p in array p_any loop
    if current_has_permission(p) then return m.business_id; end if;
  end loop;
  -- Held by their role, but the part is off for this business.
  select permission_part(x) into v_off from unnest(p_any) x
   where permission_part(x) is not null and not part_on(m.business_id, permission_part(x))
     and exists (select 1 from user_role ur join role_permission rp on rp.role = ur.role
                  where ur.app_user_id = m.id and rp.permission = x)
   limit 1;
  if v_off is not null then
    raise exception '%', format('That part is off for this business: %s', part_catalogue() -> v_off ->> 'label')
      using errcode = '42501';
  end if;
  raise exception 'You do not have permission to do this (needs %)', array_to_string(p_any, ' or ')
    using errcode = '42501';
end $$;

-- 0096's my_profile: the permissions of the parts that are on, each part that
-- is off ("off:accounting", for the screens), the plan and the type (0108).
alter function my_profile() rename to my_profile_0107;
create or replace function my_profile() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb := my_profile_0107(); b business;
begin
  if v is null then return null; end if;
  select * into b from business where id = (v ->> 'business_id')::uuid;
  return v || jsonb_build_object(
    'permissions', coalesce((select jsonb_agg(p order by p) from jsonb_array_elements_text(v -> 'permissions') p
                              where permission_part(p) is null or part_on(b.id, permission_part(p))), '[]'::jsonb)
                   || coalesce((select jsonb_agg('off:' || k order by k) from jsonb_object_keys(part_catalogue()) k
                                 where not part_on(b.id, k)), '[]'::jsonb),
    'plan', b.plan, 'business_type', b.business_type);
end $$;

-- How many places a plan has: Starter and Complete one branch and one store;
-- Business as many as it needs, a central kitchen with them.
create or replace function plan_place_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_plan text;
begin
  select plan into v_plan from business where id = new.business_id;
  if v_plan is null or v_plan = 'business' then return new; end if;
  if new.kind = 'central_kitchen' then
    raise exception 'A central kitchen is in the Business plan';
  end if;
  if exists (select 1 from location l where l.business_id = new.business_id and l.kind = new.kind
                and l.id <> new.id and coalesce(l.is_active, true)) then
    raise exception 'More than one branch or store is in the Business plan';
  end if;
  return new;
end $$;
drop trigger if exists location_plan_check on location;
create trigger location_plan_check before insert on location for each row execute function plan_place_check();

-- The business's plan, type and parts, for its screens.
create or replace function business_parts() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'plan', b.plan, 'business_type', b.business_type,
    'parts', (select jsonb_agg(jsonb_build_object(
                'part', k, 'label', part_catalogue() -> k ->> 'label',
                'in_plan', (part_catalogue() -> k -> 'plans') ? b.plan,
                'default_on', (part_catalogue() -> k -> 'on_for') ? b.business_type,
                'on', part_on(b.id, k),
                'reason', (select reason from business_part bp where bp.business_id = b.id and bp.part = k))
              order by k)
                from jsonb_object_keys(part_catalogue()) k))
    from business b where b.id = current_business_id()
$$;

-- (the owner) A part on or off, within the plan, with a reason.
create or replace function set_business_part(p_part text, p_on boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  b business; v_before boolean; v_reason text := nullif(regexp_replace(trim(coalesce(p_reason, '')), '\s+', ' ', 'g'), '');
begin
  if not current_has_role('owner') then
    raise exception 'Only the owner turns a part of the system on or off' using errcode = '42501';
  end if;
  if not part_catalogue() ? coalesce(p_part, '') then raise exception 'Choose one of the system''s parts'; end if;
  if p_on is null then raise exception 'Choose on or off'; end if;
  if v_reason is null or length(v_reason) < 6 then raise exception 'Say why, in a few words'; end if;
  select * into b from business where id = v_business;
  if p_on and not (part_catalogue() -> p_part -> 'plans') ? b.plan then
    raise exception '%', format('That part is not in the %s plan', initcap(b.plan));
  end if;
  v_before := part_on(v_business, p_part);
  insert into business_part (business_id, part, enabled, reason, set_by, set_at)
  values (v_business, p_part, p_on, v_reason, (current_member()).id, now())
  on conflict (business_id, part) do update
    set enabled = excluded.enabled, reason = excluded.reason, set_by = excluded.set_by, set_at = excluded.set_at;
  perform audit_event(v_business, 'business.part', 'business', p_part, v_reason,
    jsonb_build_object('part', p_part, 'on', v_before), jsonb_build_object('part', p_part, 'on', p_on));
  return business_parts();
end $$;

-- (the owner) The type of business, deciding which parts are on by default.
create or replace function set_business_type(p_type text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_before text; v_reason text := nullif(regexp_replace(trim(coalesce(p_reason, '')), '\s+', ' ', 'g'), '');
begin
  if not current_has_role('owner') then
    raise exception 'Only the owner changes the type of business' using errcode = '42501';
  end if;
  if coalesce(p_type, '') not in ('cafe', 'bakery', 'restaurant', 'supplier') then
    raise exception 'Choose the type of business: a café, a bakery, a restaurant or a supplier';
  end if;
  if v_reason is null or length(v_reason) < 6 then raise exception 'Say why, in a few words'; end if;
  select business_type into v_before from business where id = v_business;
  update business set business_type = p_type where id = v_business;
  -- The parts kept on when plans came (no one set them) follow the new type's defaults.
  delete from business_part where business_id = v_business and set_by is null;
  perform audit_event(v_business, 'business.type', 'business', v_business::text, v_reason,
    jsonb_build_object('type', v_before), jsonb_build_object('type', p_type));
  return business_parts();
end $$;

-- (the system's administrators) Every business, its plan and type.
create or replace function admin_businesses() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_system_admin();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', b.id, 'name', b.name, 'plan', b.plan, 'business_type', b.business_type,
      'places', (select count(*) from location l where l.business_id = b.id),
      'people', (select count(*) from app_user u where u.business_id = b.id),
      'practice', b.practice_of is not null)
    order by b.practice_of is not null, b.name) from business b), '[]'::jsonb);
end $$;

-- (the system's administrators) A business's plan: its parts follow at once;
-- nothing is lost on a smaller plan, only hidden.
create or replace function set_business_plan(p_business uuid, p_plan text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_before text; v_reason text := nullif(regexp_replace(trim(coalesce(p_reason, '')), '\s+', ' ', 'g'), '');
begin
  perform require_system_admin();
  if coalesce(p_plan, '') not in ('starter', 'complete', 'business') then
    raise exception 'Choose the plan: Starter, Complete or Business';
  end if;
  if v_reason is null or length(v_reason) < 6 then raise exception 'Say why, in a few words'; end if;
  select plan into v_before from business where id = p_business;
  if v_before is null then raise exception 'That business is not found'; end if;
  update business set plan = p_plan where id = p_business;
  perform audit_event(p_business, 'business.plan', 'business', p_business::text, v_reason,
    jsonb_build_object('plan', v_before), jsonb_build_object('plan', p_plan));
  return admin_businesses();
end $$;

grant execute on function my_profile() to authenticated;
revoke execute on function part_catalogue(), permission_part(text), part_on(uuid, text), plan_place_check(),
  my_profile_0107() from public, anon, authenticated;
revoke execute on function business_parts(), set_business_part(text, boolean, text), set_business_type(text, text),
  admin_businesses(), set_business_plan(uuid, text, text) from public, anon;
grant execute on function business_parts(), set_business_part(text, boolean, text), set_business_type(text, text),
  admin_businesses(), set_business_plan(uuid, text, text) to authenticated;
