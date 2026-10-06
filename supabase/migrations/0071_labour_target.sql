-- =============================================================================
-- 0071 — The labour cost the café aims for (round ten)
-- =============================================================================
-- The owner's answer on staffing, as chosen: a check of the week's schedule on
-- Staff — too few or too many people for how busy each part of the day
-- usually is — and a labour cost target: the share of net sales the café
-- means to pay its people, week by week and by part of the day. The check
-- reads what the café keeps already (the orders by hour, the hours on the
-- clock, the schedule). The target is a rule like the others, set on
-- Settings → Rules with a reason and kept with its history, for the café or
-- for a place; 0, the default, is no target.
--
-- Its reader gives a place's own target, else the café's: a share of sales is
-- the same for every branch. Nothing is recorded by it, and only those who see
-- pay (or set the rules) read it. This touches only the rules' list, their
-- defaults and the reader below.
-- =============================================================================

-- =============================================================================
-- 1. The rule
-- =============================================================================
-- 0067's list, and the labour target.
create or replace function rule_definitions() returns jsonb
language sql immutable set search_path = public as $$
  select '{
    "daily_sales_target":    {"kind": "amount", "min": 0, "max": 1000000000, "whole": true,
                              "scopes": ["business", "location"],
                              "label": "A day''s net sales target (0: none)"},
    "labour_target_percent": {"kind": "percent", "min": 0, "max": 100, "whole": false,
                              "scopes": ["business", "location"],
                              "label": "Labour cost the café aims for (% of net sales; 0: none)"},
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

-- 0067's defaults, and no labour target.
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
  union all
  select 'labour_target_percent', 'business', '', to_jsonb(0)
$$;

-- =============================================================================
-- 2. The target that applies: a place's own, else the café's
-- =============================================================================
create or replace function labour_target(p_location uuid default null) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := require_permission('payroll.view', 'settings.manage');
begin
  if p_location is not null
     and not exists (select 1 from location l where l.id = p_location and l.business_id = v_business) then
    raise exception 'Unknown location';
  end if;
  return coalesce((rule_value(v_business, 'labour_target_percent', null, null, p_location) #>> '{}')::numeric, 0);
end $$;

-- =============================================================================
-- 3. Who may call what
-- =============================================================================
revoke execute on function labour_target(uuid) from public, anon;
grant execute on function labour_target(uuid) to authenticated;
