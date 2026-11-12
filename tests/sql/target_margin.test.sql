-- =============================================================================
-- A target margin for each product or category (0105): set on a category, a
-- product takes it; set on the product, its own wins; taken away, none. Only
-- those who keep the recipes set it; on the audit trail.
-- =============================================================================
select test.golden_catalogue();
select test.as_admin();
create temp table ids as
select p.id as product, p.category_id as category from product p
 where p.business_id = '00000000-0000-0000-0000-0000000000b1' and p.category_id is not null
 order by p.name limit 1;
grant select on ids to public;
create function pg_temp.target() returns numeric language sql security definer as $$
  select target from product_targets() where product_id = (select product from ids)
$$;

select test.act_as('owner@example.com');
select test.eq(pg_temp.target(), null::numeric, 'none set: the café''s target');
select set_target_margin(null, (select category from ids), 60);
select test.eq((select target from product_targets() where product_id = (select product from ids)), 60::numeric,
  'its category''s 60%');
select set_target_margin((select product from ids), null, 75);
select test.eq((select target from product_targets() where product_id = (select product from ids)), 75::numeric,
  'its own 75% wins');
select set_target_margin((select product from ids), null, null);
select test.eq((select target from product_targets() where product_id = (select product from ids)), 60::numeric,
  'taken away: its category''s again');
select test.throws($$select set_target_margin((select product from ids), null, 100)$$,
  'A margin target is from 0% to under 100%', 'a margin is under 100%');
select test.throws($$select set_target_margin(null, null, 50)$$, 'Choose a product or a category', 'one of the two');
select test.act_as('cashier@example.com');
select test.throws($$select set_target_margin((select product from ids), null, 50)$$, '%permission%',
  'a cashier does not set it');
select test.as_admin();
select test.eq((select count(*)::int from audit_log where action = 'menu.target_margin'), 3, 'each on the audit trail');
