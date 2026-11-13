-- 0120: practice for each type of business (plan 4 and plan 10, step 5).
--
--   * A practice café is of its real café's type and plan, with the same
--     parts on: a restaurant practises in a restaurant, a supplier in a
--     supplier.
--   * Four more practice tasks, each only where its part is on: send a bill to
--     the kitchen and take a reservation (a restaurant); make a quote and send
--     a delivery note (a supplier or a bakery).
--
-- Nothing recorded changes; a practice café made before keeps its type until
-- it is made fresh (Practice → Start again).

-- 0096's practice café, of the real café's type, plan and parts.
do $$
begin
  if to_regprocedure('practice_seed_0119(uuid)') is null then
    alter function practice_seed(uuid) rename to practice_seed_0119;
  end if;
end $$;
create or replace function practice_seed(p_member uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_twin uuid := practice_seed_0119(p_member); v_real uuid; v_fake uuid;
begin
  select business_id into v_real from app_user where id = p_member;
  select business_id into v_fake from app_user where id = v_twin;
  update business f set business_type = r.business_type, plan = r.plan
    from business r where r.id = v_real and f.id = v_fake;
  insert into business_part (business_id, part, enabled, reason)
  select v_fake, part, enabled, 'As the real café' from business_part where business_id = v_real
  on conflict do nothing;
  return v_twin;
end $$;

-- The part a practice task needs on, if any.
create or replace function practice_task_part(p_task text) returns text
language sql immutable as $$
  select case p_task when 'kitchen_send' then 'kitchen' when 'reservation' then 'reservations'
                     when 'quote' then 'quotes' when 'delivery_note' then 'quotes' end
$$;

create or replace function practice_task_list()
returns table (task text, permission text, sort int)
language sql immutable as $$
  values ('open_drawer', 'sale.create', 10), ('sell_card', 'sale.create', 20), ('sell_cash', 'sale.create', 30),
         ('discount', 'discount.apply', 40), ('table_bill', 'sale.create', 50),
         ('kitchen_send', 'sale.create', 52), ('reservation', 'sale.create', 54),
         ('refund', 'sale.refund', 60),
         ('void', 'sale.void', 70), ('close_drawer', 'sale.create', 80), ('batch', 'production.record', 90),
         ('waste', 'waste.record', 100), ('count', 'inventory.count', 110),
         ('approve_count', 'inventory.adjust.approve', 120), ('order', 'purchase.create', 130),
         ('receive', 'purchase.receive', 140), ('transfer', 'stock.transfer', 150),
         ('expense', 'expense.record', 160), ('price', 'settings.manage', 170),
         ('quote', 'credit.manage', 172), ('delivery_note', 'credit.manage', 174),
         ('reports', 'cost.view', 180)
$$;

-- 0096's check of a task done, with the four new ones.
do $$
begin
  if to_regprocedure('practice_task_met_0119(text, uuid)') is null then
    alter function practice_task_met(text, uuid) rename to practice_task_met_0119;
  end if;
end $$;
create or replace function practice_task_met(p_task text, p_twin uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare b uuid := (select business_id from app_user where id = p_twin);
begin
  if b is null then return false; end if;
  return case p_task
    when 'kitchen_send' then exists (select 1 from kitchen_ticket where business_id = b)
    when 'reservation' then exists (select 1 from reservation where business_id = b)
    when 'quote' then exists (select 1 from sales_quote where business_id = b)
    when 'delivery_note' then exists (select 1 from delivery_note where business_id = b)
    else practice_task_met_0119(p_task, p_twin)
  end;
end $$;

-- 0096's tasks, each only where its part is on for the real café.
create or replace function practice_tasks() returns jsonb
language plpgsql security definer set search_path = public as $$
declare m app_user := practice_member(); w uuid; x record; v jsonb := '[]';
begin
  select twin_id into w from practice_twin where app_user_id = m.id;
  for x in select l.task, l.sort from practice_task_list() l
            where exists (select 1 from user_role ur join role_permission rp on rp.role = ur.role
                           where ur.app_user_id = m.id and rp.permission = l.permission)
              and (practice_task_part(l.task) is null or part_on(m.business_id, practice_task_part(l.task)))
            order by l.sort loop
    if w is not null and not exists (select 1 from practice_task_done d where d.app_user_id = m.id and d.task = x.task)
       and practice_task_met(x.task, w) then
      insert into practice_task_done (app_user_id, task) values (m.id, x.task) on conflict do nothing;
    end if;
    v := v || jsonb_build_object('task', x.task,
      'done_at', (select done_at from practice_task_done d where d.app_user_id = m.id and d.task = x.task));
  end loop;
  return jsonb_build_object('started', w is not null,
    'started_at', (select started_at from practice_twin where app_user_id = m.id), 'tasks', v);
end $$;

-- 0096's team, each person's tasks only those whose part is on.
create or replace function practice_team() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m app_user := practice_member();
begin
  if not exists (select 1 from user_role ur join role_permission rp on rp.role = ur.role
                  where ur.app_user_id = m.id and rp.permission = 'staff.manage') then
    raise exception 'You do not have permission to do this (needs %)', 'staff.manage' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'roles', p.roles,
             'tasks', p.total, 'done', p.done, 'started_at', p.started_at, 'last_done_at', p.last_done)
           order by p.full_name)
      from (select u.id, u.full_name,
                   (select jsonb_agg(distinct ur.role) from user_role ur where ur.app_user_id = u.id) as roles,
                   (select count(*) from practice_task_list() l
                     where exists (select 1 from user_role ur join role_permission rp on rp.role = ur.role
                                    where ur.app_user_id = u.id and rp.permission = l.permission)
                       and (practice_task_part(l.task) is null or part_on(m.business_id, practice_task_part(l.task)))) as total,
                   (select count(*) from practice_task_done d join practice_task_list() l on l.task = d.task
                     where d.app_user_id = u.id
                       and exists (select 1 from user_role ur join role_permission rp on rp.role = ur.role
                                    where ur.app_user_id = u.id and rp.permission = l.permission)
                       and (practice_task_part(l.task) is null or part_on(m.business_id, practice_task_part(l.task)))) as done,
                   (select started_at from practice_twin where app_user_id = u.id) as started_at,
                   (select max(done_at) from practice_task_done where app_user_id = u.id) as last_done
              from app_user u
             where u.business_id = m.business_id and u.is_active and u.auth_user_id is not null) p), '[]'::jsonb);
end $$;

revoke execute on function practice_seed_0119(uuid), practice_seed(uuid), practice_task_part(text),
  practice_task_met_0119(text, uuid), practice_task_met(text, uuid)
  from public, anon, authenticated;
