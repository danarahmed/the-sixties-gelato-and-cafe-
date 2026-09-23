-- =============================================================================
-- Shared fixtures: link the four seeded people to fixed auth identities, and
-- give tests a one-line way to act as any of them (or as the anonymous public).
--
-- Switching identity works from any current role because SET ROLE is checked
-- against the SESSION user (the superuser running the tests), not the role a
-- test has already assumed.
-- =============================================================================

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner@example.com'),
  ('a0000000-0000-0000-0000-00000000000b', 'manager@example.com'),
  ('a0000000-0000-0000-0000-00000000000c', 'cashier@example.com'),
  ('a0000000-0000-0000-0000-00000000000d', 'counter@example.com')
on conflict do nothing;

update app_user set auth_user_id = 'a0000000-0000-0000-0000-00000000000a' where email = 'owner@example.com';
update app_user set auth_user_id = 'a0000000-0000-0000-0000-00000000000b' where email = 'manager@example.com';
update app_user set auth_user_id = 'a0000000-0000-0000-0000-00000000000c' where email = 'cashier@example.com';
update app_user set auth_user_id = 'a0000000-0000-0000-0000-00000000000d' where email = 'counter@example.com';

-- A second business, so tenant isolation can be tested for real.
insert into business (id, name) values ('00000000-0000-0000-0000-0000000000b2', 'Other Café')
on conflict do nothing;

-- Act as a named person: authenticated role + their JWT subject.
create or replace function test.act_as(p_email text) returns void
language plpgsql as $$
declare uid uuid;
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
  select id into uid from auth.users where email = p_email;
  if uid is null then raise exception 'test.act_as: no auth user %', p_email; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;

-- Act as the anonymous public: what anyone holding the published anon key gets.
create or replace function test.act_as_anon() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, false);
  execute 'set role anon';
end $$;

-- Back to the test superuser, for setup and for inspecting true state.
create or replace function test.as_admin() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
end $$;

grant execute on all functions in schema test to public;
