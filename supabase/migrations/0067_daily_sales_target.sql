-- =============================================================================
-- 0067 — A day's net sales target
-- =============================================================================
-- The owner sets the net sales the café aims for in a day on Settings → Rules,
-- with a reason, like every rule; the dashboard shows today against it, and
-- where today should be by now from how a usual day of its kind sells. 0, the
-- default, is no target, and the dashboard shows none.
--
-- A branch's day (someone who works at one place reads their place's) is
-- measured against a target of the branch's own, a row of the rule for that
-- place, or the café's while the café has one branch: the café's target is no
-- one branch's when there are several.
--
-- Nothing is recorded by the target and nothing but the dashboard reads it.
-- This touches only the rules' list, their defaults and the reader below, so
-- it applies on its own, before or after 0064–0066.

-- =============================================================================
-- 1. The rule
-- =============================================================================
-- 0050's list, and the target first.
create or replace function rule_definitions() returns jsonb
language sql immutable set search_path = public as $$
  select '{
    "daily_sales_target":    {"kind": "amount", "min": 0, "max": 1000000000, "whole": true,
                              "scopes": ["business", "location"],
                              "label": "A day''s net sales target (0: none)"},
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
                              "label": "Purchase orders a manager approves, up to"},
    "overtime_percent":      {"kind": "percent", "min": 100, "max": 300, "whole": false,
                              "scopes": ["business"],
                              "label": "Overtime is paid at (% of an hour''s pay)"},
    "late_after_minutes":    {"kind": "minutes", "min": 0, "max": 120, "whole": true,
                              "scopes": ["business"],
                              "label": "Late, or leaving early, by more than"},
    "clocked_in_alert_hours": {"kind": "hours", "min": 4, "max": 24, "whole": true,
                              "scopes": ["business"],
                              "label": "Someone still clocked in after"},
    "payday":                {"kind": "day", "min": 1, "max": 28, "whole": true,
                              "scopes": ["business"],
                              "label": "Salaries are paid on the day of the month"},
    "loyalty":               {"kind": "choice", "choices": ["on", "off"],
                              "scopes": ["business"],
                              "label": "Customers earn points, and take rewards"},
    "loyalty_point_per":     {"kind": "amount", "min": 1, "max": 1000000, "whole": true,
                              "scopes": ["business"],
                              "label": "A customer earns a point for every"},
    "loyalty_reward_points": {"kind": "points", "min": 1, "max": 100000, "whole": true,
                              "scopes": ["business"],
                              "label": "A reward takes"},
    "loyalty_reward_value":  {"kind": "amount", "min": 1, "max": 10000000, "whole": true,
                              "scopes": ["business"],
                              "label": "A reward is worth"}
  }'::jsonb
$$;

-- 0050's defaults, and no target.
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
  union all
  select 'overtime_percent', 'business', '', to_jsonb(150)
  union all
  select 'late_after_minutes', 'business', '', to_jsonb(5)
  union all
  select 'clocked_in_alert_hours', 'business', '', to_jsonb(16)
  union all
  select 'payday', 'business', '', to_jsonb(1)
  union all
  select 'loyalty', 'business', '', to_jsonb('on'::text)
  union all
  select 'loyalty_point_per', 'business', '', to_jsonb(1000)
  union all
  select 'loyalty_reward_points', 'business', '', to_jsonb(100)
  union all
  select 'loyalty_reward_value', 'business', '', to_jsonb(5000)
  union all
  select 'daily_sales_target', 'business', '', to_jsonb(0)
$$;

-- =============================================================================
-- 2. The target that applies to a day: the café's, or a branch's
-- =============================================================================
create or replace function daily_sales_target(p_location uuid default null) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('profit.view');
  v jsonb;
begin
  if p_location is null then
    return coalesce((rule_value(v_business, 'daily_sales_target') #>> '{}')::numeric, 0);
  end if;
  if not exists (select 1 from location l where l.id = p_location and l.business_id = v_business) then
    raise exception 'Unknown location';
  end if;
  select x.value into v from rule_rows(v_business, 'daily_sales_target') x
   where x.scope_type = 'location' and x.scope_id = p_location::text;
  if found then
    return coalesce((v #>> '{}')::numeric, 0);
  end if;
  -- A place that sells nothing has none of the café's target; a branch has
  -- it only while it is the café's one branch.
  if exists (select 1 from location l where l.id = p_location and l.kind = 'branch')
     and (select count(*) from location l
           where l.business_id = v_business and l.kind = 'branch' and l.is_active) = 1 then
    return coalesce((rule_value(v_business, 'daily_sales_target') #>> '{}')::numeric, 0);
  end if;
  return 0;
end $$;

-- =============================================================================
-- 3. Who may call what
-- =============================================================================
revoke execute on function daily_sales_target(uuid) from public, anon;
grant execute on function daily_sales_target(uuid) to authenticated;
