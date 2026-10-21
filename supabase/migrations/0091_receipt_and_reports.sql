-- =============================================================================
-- 0091 — The café's own receipt, and each person's reports first (SMART_PLAN F4, F5)
-- =============================================================================
-- The café's own receipt (F5). What the bill, the receipt and the refund's slip
-- print besides the sale: the café's logo, its name in Arabic and Kurdish
-- beside its own, a thank-you line in the three languages, its Instagram,
-- Facebook and TikTok, the Wi-Fi's name and password, a QR code to its menu or
-- to a page for reviews (as the owner chose: a choice on Settings, each a link
-- the owner gives), and a line at the foot. Set on Settings
-- (settings.manage); read by anyone who prints (any member).
--
-- Each person's reports first (F4). As the owner chose, nobody arranges their
-- own screens: the Dashboard is arranged for each role by the app, and Reports
-- puts first the reports each person opens most, learned from what they open.
-- This keeps how often each person opened each report.
--
--  * receipt_setup (one row per café), receipt_logo; receipt_setup,
--    set_receipt_setup, set_receipt_logo, clear_receipt_logo.
--  * report_visit; note_report_visit, my_report_visits.
--
-- Nothing recorded changes.
-- =============================================================================

-- =============================================================================
-- 1. What the receipt says
-- =============================================================================
create table if not exists receipt_setup (
  business_id  uuid primary key references business (id) on delete cascade,
  name_ar      text,
  name_ckb     text,
  thanks_en    text,
  thanks_ar    text,
  thanks_ckb   text,
  instagram    text,
  facebook     text,
  tiktok       text,
  wifi_name    text,
  wifi_password text,
  qr           text not null default 'none',
  menu_url     text,
  review_url   text,
  footer       text,
  updated_by   uuid references app_user (id),
  updated_at   timestamptz not null default now(),
  constraint receipt_setup_qr check (qr in ('none', 'menu', 'review')),
  constraint receipt_setup_qr_link check ((qr <> 'menu' or menu_url is not null)
                                          and (qr <> 'review' or review_url is not null))
);
alter table receipt_setup enable row level security;
alter table receipt_setup force row level security;
drop policy if exists member_read on receipt_setup;
create policy member_read on receipt_setup for select to authenticated
  using (business_id = (select current_business_id()));
grant select on receipt_setup to authenticated;

-- The logo, small, kept in the database as a product's photo is (0018).
create table if not exists receipt_logo (
  business_id  uuid primary key references business (id) on delete cascade,
  content_type text not null,
  data         bytea not null,
  updated_by   uuid references app_user (id),
  updated_at   timestamptz not null default now(),
  constraint receipt_logo_type check (content_type in ('image/png', 'image/jpeg', 'image/webp'))
);
alter table receipt_logo enable row level security;
alter table receipt_logo force row level security;
drop policy if exists member_read on receipt_logo;
create policy member_read on receipt_logo for select to authenticated
  using (business_id = (select current_business_id()));
grant select on receipt_logo to authenticated;

-- What a receipt prints, for anyone of the café: the logo as a data address,
-- so a till prints it with no connection.
create or replace function receipt_setup() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', b.name,
    'name_ar', r.name_ar, 'name_ckb', r.name_ckb,
    'thanks_en', r.thanks_en, 'thanks_ar', r.thanks_ar, 'thanks_ckb', r.thanks_ckb,
    'instagram', r.instagram, 'facebook', r.facebook, 'tiktok', r.tiktok,
    'wifi_name', r.wifi_name, 'wifi_password', r.wifi_password,
    'qr', coalesce(r.qr, 'none'), 'menu_url', r.menu_url, 'review_url', r.review_url,
    'footer', r.footer,
    'logo', (select 'data:' || l.content_type || ';base64,' || replace(encode(l.data, 'base64'), E'\n', '')
               from receipt_logo l where l.business_id = b.id))
    from business b left join receipt_setup r on r.business_id = b.id
   where b.id = current_business_id()
$$;

-- A text of the setup, trimmed, empty as none, at most p_max letters.
create or replace function receipt_text(p_setup jsonb, p_key text, p_max int) returns text
language plpgsql immutable as $$
declare v text := nullif(btrim(coalesce(p_setup ->> p_key, '')), '');
begin
  if v is not null and length(v) > p_max then
    raise exception 'A line of the receipt is at most % letters', p_max;
  end if;
  return v;
end $$;

-- A link the QR code leads to: a web address, https.
create or replace function receipt_link(p_setup jsonb, p_key text) returns text
language plpgsql immutable as $$
declare v text := receipt_text(p_setup, p_key, 300);
begin
  if v is not null and v !~* '^https://[^\s/$.?#][^\s]*$' then
    raise exception 'A link starts with https:// and has no spaces';
  end if;
  return v;
end $$;

-- p_setup: every field of the receipt, as the form has them; one left out or
-- empty is none.
create or replace function set_receipt_setup(p_setup jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_before jsonb; v_qr text := coalesce(nullif(p_setup ->> 'qr', ''), 'none');
  v_menu text; v_review text;
begin
  if p_setup is null or jsonb_typeof(p_setup) <> 'object' then
    raise exception 'The receipt''s setup cannot be read';
  end if;
  if v_qr not in ('none', 'menu', 'review') then
    raise exception 'The QR code leads to the menu, to the reviews, or nowhere';
  end if;
  v_menu := receipt_link(p_setup, 'menu_url');
  v_review := receipt_link(p_setup, 'review_url');
  if v_qr = 'menu' and v_menu is null then
    raise exception 'Give the menu''s link for the QR code to lead to';
  end if;
  if v_qr = 'review' and v_review is null then
    raise exception 'Give the reviews'' link for the QR code to lead to';
  end if;
  select to_jsonb(r) - 'business_id' - 'updated_by' - 'updated_at' into v_before
    from receipt_setup r where r.business_id = v_business;
  insert into receipt_setup (business_id, name_ar, name_ckb, thanks_en, thanks_ar, thanks_ckb, instagram, facebook,
                             tiktok, wifi_name, wifi_password, qr, menu_url, review_url, footer, updated_by, updated_at)
  values (v_business,
          receipt_text(p_setup, 'name_ar', 60), receipt_text(p_setup, 'name_ckb', 60),
          receipt_text(p_setup, 'thanks_en', 120), receipt_text(p_setup, 'thanks_ar', 120),
          receipt_text(p_setup, 'thanks_ckb', 120),
          ltrim(receipt_text(p_setup, 'instagram', 60), '@'), receipt_text(p_setup, 'facebook', 80),
          ltrim(receipt_text(p_setup, 'tiktok', 60), '@'),
          receipt_text(p_setup, 'wifi_name', 60), receipt_text(p_setup, 'wifi_password', 60),
          v_qr, v_menu, v_review, receipt_text(p_setup, 'footer', 200),
          (current_member()).id, now())
  on conflict (business_id) do update set
    name_ar = excluded.name_ar, name_ckb = excluded.name_ckb, thanks_en = excluded.thanks_en,
    thanks_ar = excluded.thanks_ar, thanks_ckb = excluded.thanks_ckb, instagram = excluded.instagram,
    facebook = excluded.facebook, tiktok = excluded.tiktok, wifi_name = excluded.wifi_name,
    wifi_password = excluded.wifi_password, qr = excluded.qr, menu_url = excluded.menu_url,
    review_url = excluded.review_url, footer = excluded.footer, updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;
  perform audit_event(v_business, 'settings.receipt', 'business', v_business::text, null, v_before,
    (select to_jsonb(r) - 'business_id' - 'updated_by' - 'updated_at' from receipt_setup r
      where r.business_id = v_business));
  return receipt_setup();
end $$;

-- The logo: a PNG, JPEG or WebP picture of at most 60 KB (the screen makes it small first).
create or replace function set_receipt_logo(p_content_type text, p_data text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage'); v_bytes bytea;
begin
  if p_content_type is null or p_content_type not in ('image/png', 'image/jpeg', 'image/webp') then
    raise exception 'Use a PNG, JPEG or WebP picture';
  end if;
  begin
    v_bytes := decode(p_data, 'base64');
  exception when others then
    raise exception 'The picture could not be read';
  end;
  if v_bytes is null or length(v_bytes) = 0 or length(v_bytes) > 60000 then
    raise exception 'The logo must be smaller than 60 KB';
  end if;
  if not ((p_content_type = 'image/png' and substring(v_bytes from 1 for 8) = '\x89504e470d0a1a0a'::bytea)
       or (p_content_type = 'image/jpeg' and substring(v_bytes from 1 for 3) = '\xffd8ff'::bytea)
       or (p_content_type = 'image/webp' and substring(v_bytes from 1 for 4) = '\x52494646'::bytea
                                        and substring(v_bytes from 9 for 4) = '\x57454250'::bytea)) then
    raise exception 'That file is not a PNG, JPEG or WebP picture';
  end if;
  insert into receipt_logo (business_id, content_type, data, updated_by, updated_at)
  values (v_business, p_content_type, v_bytes, (current_member()).id, now())
  on conflict (business_id) do update
    set content_type = excluded.content_type, data = excluded.data, updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;
  perform audit_event(v_business, 'settings.receipt_logo', 'business', v_business::text, null, null,
    jsonb_build_object('bytes', length(v_bytes)));
  return receipt_setup();
end $$;

create or replace function clear_receipt_logo() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage');
begin
  delete from receipt_logo where business_id = v_business;
  perform audit_event(v_business, 'settings.receipt_logo', 'business', v_business::text, null, null,
    jsonb_build_object('bytes', 0));
  return receipt_setup();
end $$;

-- =============================================================================
-- 2. The reports each person opens
-- =============================================================================
create table if not exists report_visit (
  app_user_id uuid not null references app_user (id) on delete cascade,
  business_id uuid not null references business (id) on delete cascade,
  path        text not null,
  visits      int not null default 0,
  last_at     timestamptz not null default now(),
  primary key (app_user_id, path),
  constraint report_visit_path check (path ~ '^/reports(/[a-z-]{1,30})?$')
);
alter table report_visit enable row level security;
alter table report_visit force row level security;
drop policy if exists own_read on report_visit;
create policy own_read on report_visit for select to authenticated
  using (app_user_id = (select current_app_user_id()));
grant select on report_visit to authenticated;

-- A report opened by the person signed in: counted once more.
create or replace function note_report_visit(p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare m app_user := current_member();
begin
  if m.id is null then raise exception 'Sign in again' using errcode = '42501'; end if;
  if p_path is null or p_path !~ '^/reports(/[a-z-]{1,30})?$' then
    raise exception 'That is not one of the reports';
  end if;
  insert into report_visit (app_user_id, business_id, path, visits, last_at)
  values (m.id, m.business_id, p_path, 1, now())
  on conflict (app_user_id, path) do update set visits = report_visit.visits + 1, last_at = now();
end $$;

-- The reports the person signed in opens most: [{path, visits}], most first.
create or replace function my_report_visits() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('path', v.path, 'visits', v.visits)
                            order by v.visits desc, v.last_at desc), '[]'::jsonb)
    from report_visit v where v.app_user_id = (current_member()).id
$$;

-- =============================================================================
-- 3. Who may call what
-- =============================================================================
revoke execute on function receipt_text(jsonb, text, int), receipt_link(jsonb, text)
  from public, anon, authenticated;
revoke execute on function receipt_setup(), set_receipt_setup(jsonb), set_receipt_logo(text, text),
  clear_receipt_logo(), note_report_visit(text), my_report_visits()
  from public, anon;
grant execute on function receipt_setup(), set_receipt_setup(jsonb), set_receipt_logo(text, text),
  clear_receipt_logo(), note_report_visit(text), my_report_visits()
  to authenticated;
