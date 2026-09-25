-- =============================================================================
-- 0032 — Languages the café adds, and its own words for any phrase
-- =============================================================================
-- Every screen speaks English, Arabic and Kurdish: the app carries their
-- words. The owner (or general manager) can now add another language on
-- Settings → Languages, and give any phrase the café's own words in any
-- language: a correction to the built-in Arabic or Kurdish, or the words of a
-- language the app does not carry. A phrase with no words in a language shows
-- its English.
--
--  * A phrase is kept by its English ("Waiting to be paid out", or a dotted
--    key such as "pos.title"), as the app's phrase books keep it; the words
--    keep every {placeholder} the English has.
--  * Nothing reads the tables directly: every page asks app_words() for the
--    café's languages and the reader's language's words; Settings asks
--    language_settings(). Adding a language, taking it out of use, and every
--    change of words are on the audit trail.
--  * Clearing the test records keeps both (supabase/remediation/reset-test-data.sql).

-- =============================================================================
-- 1. The languages, and the words
-- =============================================================================
create table if not exists app_language (
  business_id uuid not null references business (id),
  code        text not null check (code ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$'),
  name        text not null check (length(btrim(name)) between 1 and 40),
  dir         text not null default 'ltr' check (dir in ('ltr', 'rtl')),
  is_active   boolean not null default true,
  created_by  uuid references app_user (id),
  created_at  timestamptz not null default now(),
  primary key (business_id, code),
  check (code not in ('en', 'ar', 'ckb'))
);
alter table app_language enable row level security;
alter table app_language force row level security;

create table if not exists app_phrase (
  business_id uuid not null references business (id),
  locale      text not null check (locale ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$'),
  phrase      text not null check (length(phrase) between 1 and 2000),
  words       text not null check (length(btrim(words)) between 1 and 4000),
  updated_by  uuid references app_user (id),
  updated_at  timestamptz not null default now(),
  primary key (business_id, locale, phrase)
);
alter table app_phrase enable row level security;
alter table app_phrase force row level security;

-- The {placeholders} of a phrase, in order: what its words must keep.
create or replace function phrase_placeholders(p_text text) returns text[]
language sql immutable set search_path = public as $$
  select coalesce(array_agg(m[1] order by m[1]), '{}') from regexp_matches(p_text, '\{(\w+)\}', 'g') m
$$;

-- =============================================================================
-- 2. What every page reads: the café's languages, and one language's words
-- =============================================================================
create or replace function app_words(p_locale text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'languages', coalesce((
      select jsonb_agg(jsonb_build_object('code', l.code, 'name', l.name, 'dir', l.dir) order by l.created_at, l.code)
        from app_language l
       where l.business_id = current_business_id() and l.is_active), '[]'::jsonb),
    'phrases', coalesce((
      select jsonb_object_agg(p.phrase, p.words)
        from app_phrase p
       where p.business_id = current_business_id() and p.locale = lower(p_locale)
         and (p.locale in ('en', 'ar', 'ckb')
              or exists (select 1 from app_language l
                          where l.business_id = p.business_id and l.code = p.locale and l.is_active))), '{}'::jsonb))
$$;

-- Settings → Languages: every language the café added, in use or not, and how
-- many phrases have the café's own words in each language, built-in ones too.
create or replace function language_settings() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_business uuid := require_permission('settings.manage');
begin
  return jsonb_build_object(
    'languages', coalesce((
      select jsonb_agg(jsonb_build_object('code', l.code, 'name', l.name, 'dir', l.dir, 'is_active', l.is_active,
                                          'created_at', l.created_at) order by l.created_at, l.code)
        from app_language l where l.business_id = v_business), '[]'::jsonb),
    'own_words', coalesce((
      select jsonb_object_agg(x.locale, x.n)
        from (select p.locale, count(*) as n from app_phrase p where p.business_id = v_business group by p.locale) x),
      '{}'::jsonb));
end $$;

-- =============================================================================
-- 3. A language added, renamed, taken out of use or brought back
-- =============================================================================
create or replace function save_language(p_code text, p_name text, p_dir text default 'ltr',
                                         p_active boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_code text := lower(nullif(btrim(p_code), ''));
  v_name text := nullif(btrim(p_name), '');
  v_dir text := lower(coalesce(nullif(btrim(p_dir), ''), 'ltr'));
  v_old app_language;
begin
  if v_code is null or v_code !~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$' then
    raise exception 'A language''s code is two or three small Latin letters, as the world writes it (tr, fa, kmr), with a region after a dash if needed (pt-br)';
  end if;
  if v_code in ('en', 'ar', 'ckb') then
    raise exception 'English, Arabic and Kurdish are built in: correct their words instead of adding them';
  end if;
  if v_name is null or length(v_name) > 40 then
    raise exception 'Name the language as its speakers write it, in up to 40 letters (Türkçe, فارسی)';
  end if;
  if v_dir not in ('ltr', 'rtl') then
    raise exception 'A language is written left to right (ltr) or right to left (rtl)';
  end if;
  select * into v_old from app_language where business_id = v_business and code = v_code for update;
  if not found then
    insert into app_language (business_id, code, name, dir, is_active, created_by)
    values (v_business, v_code, v_name, v_dir, coalesce(p_active, true), current_app_user_id());
    perform audit_event(v_business, 'language.add', 'app_language', v_code, null, null,
      jsonb_build_object('code', v_code, 'name', v_name, 'dir', v_dir, 'is_active', coalesce(p_active, true)));
  else
    update app_language set name = v_name, dir = v_dir, is_active = coalesce(p_active, v_old.is_active)
     where business_id = v_business and code = v_code;
    perform audit_event(v_business, 'language.update', 'app_language', v_code, null,
      jsonb_build_object('name', v_old.name, 'dir', v_old.dir, 'is_active', v_old.is_active),
      jsonb_build_object('name', v_name, 'dir', v_dir, 'is_active', coalesce(p_active, v_old.is_active)));
  end if;
  return jsonb_build_object('code', v_code, 'name', v_name, 'dir', v_dir,
                            'is_active', coalesce(p_active, v_old.is_active, true));
end $$;

-- =============================================================================
-- 4. The café's own words for phrases in one language
-- =============================================================================
-- p_phrases is {"phrase": "words"}; empty words (or null) give the phrase back
-- its built-in words, or its English. Words that are already so change nothing.
create or replace function save_phrases(p_locale text, p_phrases jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('settings.manage');
  v_locale text := lower(nullif(btrim(p_locale), ''));
  v_set int := 0; v_cleared int := 0; v_n int := 0;
  e record; v_words text;
begin
  if v_locale is null or (v_locale not in ('en', 'ar', 'ckb')
     and not exists (select 1 from app_language where business_id = v_business and code = v_locale)) then
    raise exception 'Add the language on Settings → Languages first';
  end if;
  if p_phrases is null or jsonb_typeof(p_phrases) <> 'object' then
    raise exception 'Give the words as {"phrase": "words"}';
  end if;
  for e in select key, value from jsonb_each(p_phrases) loop
    v_n := v_n + 1;
    if v_n > 5000 then raise exception 'Give at most 5000 phrases at a time'; end if;
    if length(e.key) = 0 or length(e.key) > 2000 then
      raise exception 'A phrase is 1 to 2000 letters';
    end if;
    if jsonb_typeof(e.value) not in ('string', 'null') then
      raise exception 'Give the words for "%" as text', left(e.key, 80);
    end if;
    v_words := nullif(btrim(e.value #>> '{}'), '');
    if v_words is null then
      delete from app_phrase where business_id = v_business and locale = v_locale and phrase = e.key;
      if found then v_cleared := v_cleared + 1; end if;
      continue;
    end if;
    if length(v_words) > 4000 then
      raise exception 'The words for "%" are too long: 4000 letters at most', left(e.key, 80);
    end if;
    if phrase_placeholders(e.key) <> phrase_placeholders(v_words) then
      raise exception 'Keep % in the words for "%", as the English has them',
        array_to_string(array(select '{' || x || '}' from unnest(phrase_placeholders(e.key)) x), ' '), left(e.key, 80);
    end if;
    insert into app_phrase (business_id, locale, phrase, words, updated_by)
    values (v_business, v_locale, e.key, v_words, current_app_user_id())
    on conflict (business_id, locale, phrase) do update
      set words = excluded.words, updated_by = excluded.updated_by, updated_at = now()
      where app_phrase.words is distinct from excluded.words;
    if found then v_set := v_set + 1; end if;
  end loop;
  if v_set + v_cleared > 0 then
    perform audit_event(v_business, 'language.words', 'app_language', v_locale, null, null,
      jsonb_build_object('set', v_set, 'cleared', v_cleared));
  end if;
  return jsonb_build_object('set', v_set, 'cleared', v_cleared);
end $$;

-- =============================================================================
-- 5. Who may call what
-- =============================================================================
revoke execute on function phrase_placeholders(text) from public, anon, authenticated;
revoke execute on function
  app_words(text), language_settings(), save_language(text, text, text, boolean), save_phrases(text, jsonb)
  from public, anon;
grant execute on function
  app_words(text), language_settings(), save_language(text, text, text, boolean), save_phrases(text, jsonb)
  to authenticated;
