-- Smoke: the harness built what the other tests assume.
select test.eq((select count(*) from business where id = '00000000-0000-0000-0000-0000000000b1')::int, 1, 'demo business exists');
select test.eq((select count(*) from app_user where auth_user_id is not null)::int, 4, 'four people linked to auth');
select test.act_as('cashier@example.com');
select test.eq(auth.uid(), 'a0000000-0000-0000-0000-00000000000c'::uuid, 'act_as sets the JWT subject');
select test.eq(current_user::text, 'authenticated', 'act_as assumes the authenticated role');
select test.act_as_anon();
select test.eq(current_user::text, 'anon', 'act_as_anon assumes the anon role');
select test.as_admin();
