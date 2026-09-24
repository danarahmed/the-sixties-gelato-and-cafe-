-- =============================================================================
-- 0020_discount_rounding.sql — a percentage discount comes to a round sum.
--
-- 47% off a bill of 8,500 IQD is 3,995 to the dinar, which leaves the customer
-- 4,505 to pay: five dinars nobody can hand over. The café rounds a discount
-- given as a percentage to the nearest 500 IQD instead (4,000 off, 4,500 to
-- pay). Exactly half-way rounds up, in the customer's favour, and a discount is
-- still never more than the bill. An amount typed in is taken as it is: the
-- cashier chose it.
--
-- The step is the business's own setting, so a different rule, or another
-- currency, needs no change to the code.
-- =============================================================================

alter table business add column if not exists discount_round_to numeric not null default 500;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'business_discount_round_to_ok') then
    alter table business add constraint business_discount_round_to_ok check (discount_round_to > 0);
  end if;
end $$;

-- 0019's sale_discount, with a percentage rounded to the business's step.
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
    select discount_round_to into v_step from business where id = p_business;
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

-- 0016's my_profile, now with the step, so the till shows the discount the
-- books will record.
create or replace function my_profile() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when m.id is null then null else jsonb_build_object(
    'id', m.id, 'name', m.full_name, 'business_id', m.business_id,
    'business_name', (select name from business where id = m.business_id),
    'timezone', (select timezone from business where id = m.business_id),
    'currency', (select currency_code from business where id = m.business_id),
    'currency_decimals', (select currency_decimals from business where id = m.business_id),
    'discount_round_to', (select discount_round_to from business where id = m.business_id),
    'roles', coalesce((select jsonb_agg(role order by role) from user_role where app_user_id = m.id), '[]'),
    'permissions', coalesce((select jsonb_agg(distinct rp.permission order by rp.permission)
                               from user_role ur join role_permission rp on rp.role = ur.role
                              where ur.app_user_id = m.id), '[]'))
  end
  from (select * from app_user where auth_user_id = auth.uid() and is_active limit 1) m
  right join (select 1) one on true
$$;
