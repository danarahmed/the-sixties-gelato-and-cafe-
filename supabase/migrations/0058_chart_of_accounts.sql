-- =============================================================================
-- 0058 — The chart of accounts on a screen (the August audit's M-06)
-- =============================================================================
-- The accounts the café's books need are all there, but adding one took a
-- migration. The owner, a general manager or the accountant (accounting.post)
-- can now add an account for an income or a cost the café wants to see apart
-- (repairs, the internet, catering), rename one the café added, and take one
-- out of use or bring it back.
--
--  * Only income (4000–4999) and costs (5000–6999). The reports place an
--    account by its kind and its code: 4… is income, 5… the cost of what was
--    sold, 6… the running costs. An asset, a debt or the owner's money is still
--    added by a migration, where the balance sheet and the cash flow are taught
--    where it belongs.
--  * The accounts the system posts to (is_system) are neither renamed nor
--    taken out of use here.
--  * An account out of use takes no new posting: each function that posts to
--    an account someone chooses (an expense, a bill for an account, a journal)
--    asks for one in use, and the screens offer only those. What was posted to
--    it stays in every report. It is not taken out of use while a draft
--    journal has a line on it.
--  * Its name in Arabic and in Kurdish is kept as the café's own words for its
--    name (app_phrase, 0032), so every screen shows it in the reader's
--    language; a name given no words shows as it was typed. Renamed, it keeps
--    its words unless new ones are given.
--  * Each change is on the audit trail: account.create, account.rename and
--    account.in_use, and each call may be retried with its key (0035).

-- =============================================================================
-- 1. An account's name, and its words in Arabic and Kurdish
-- =============================================================================
create or replace function account_name_ok(p_name text) returns text
language plpgsql immutable set search_path = public as $$
declare v_name text := nullif(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), '');
begin
  if v_name is null then raise exception 'Name the account'; end if;
  if length(v_name) > 60 then raise exception 'An account''s name is at most 60 letters'; end if;
  return v_name;
end $$;

-- The café's own words for an account's name, as 0032 keeps words for any
-- phrase: {"ar": "…", "ckb": "…"}; a language left empty is left as it was.
create or replace function account_names_save(p_business uuid, p_name text, p_names jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e record; v_words text; v_saved jsonb := '{}';
begin
  if p_names is null or p_names = 'null'::jsonb then return v_saved; end if;
  if jsonb_typeof(p_names) <> 'object' then
    raise exception 'Give the account''s other names as {"ar": "…", "ckb": "…"}';
  end if;
  for e in select key, value from jsonb_each(p_names) loop
    if e.key not in ('ar', 'ckb') then
      raise exception 'An account''s other names are its Arabic (ar) and Kurdish (ckb)';
    end if;
    if jsonb_typeof(e.value) not in ('string', 'null') then
      raise exception 'Give the account''s name in % as text', e.key;
    end if;
    v_words := nullif(regexp_replace(btrim(coalesce(e.value #>> '{}', '')), '\s+', ' ', 'g'), '');
    continue when v_words is null;
    if length(v_words) > 60 then raise exception 'An account''s name is at most 60 letters'; end if;
    insert into app_phrase (business_id, locale, phrase, words, updated_by)
    values (p_business, e.key, p_name, v_words, current_app_user_id())
    on conflict (business_id, locale, phrase)
      do update set words = excluded.words, updated_by = excluded.updated_by, updated_at = now();
    v_saved := v_saved || jsonb_build_object(e.key, v_words);
  end loop;
  return v_saved;
end $$;

-- The café's account by its code, locked to change.
create or replace function account_to_change(p_business uuid, p_code text) returns gl_account
language plpgsql security definer set search_path = public as $$
declare a gl_account;
begin
  select * into a from gl_account where business_id = p_business and code = btrim(coalesce(p_code, '')) for update;
  if a.id is null then raise exception 'There is no account %', btrim(coalesce(p_code, '')); end if;
  if a.is_system then
    raise exception 'Account % % is one the system posts to: it is kept as it is', a.code, a.name;
  end if;
  return a;
end $$;

-- =============================================================================
-- 2. An account added
-- =============================================================================
create or replace function create_account__run(p_code text, p_name text, p_type text, p_names jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_code text := btrim(coalesce(p_code, ''));
  v_name text := account_name_ok(p_name);
  v_type account_type;
  v_other gl_account;
  v_names jsonb;
begin
  if p_type is null or p_type not in ('revenue', 'expense') then
    raise exception 'An account added here is an income or a cost: an asset, a debt or the owner''s money is added by whoever looks after the system';
  end if;
  v_type := p_type::account_type;
  if v_code !~ '^[0-9]{4}$' then raise exception 'An account''s code is four digits'; end if;
  if v_type = 'revenue' and v_code not between '4000' and '4999' then
    raise exception 'An income''s code is from 4000 to 4999';
  end if;
  if v_type = 'expense' and v_code not between '5000' and '6999' then
    raise exception 'A cost''s code is from 5000 to 6999: 5… for the cost of what was sold, 6… for the running costs';
  end if;
  -- One at a time, so two added at once cannot take one name twice.
  perform pg_advisory_xact_lock(hashtext('gl_account:' || v_business::text));
  select * into v_other from gl_account where business_id = v_business and code = v_code;
  if v_other.id is not null then raise exception 'Account % is %', v_code, v_other.name; end if;
  select * into v_other from gl_account where business_id = v_business and name_key(name) = name_key(v_name);
  if v_other.id is not null then raise exception '% is account % already', v_other.name, v_other.code; end if;
  insert into gl_account (business_id, code, name, account_type, normal_balance, is_active, is_system)
  values (v_business, v_code, v_name, v_type,
          (case when v_type = 'revenue' then 'credit' else 'debit' end)::normal_balance, true, false);
  v_names := account_names_save(v_business, v_name, p_names);
  return jsonb_build_object('code', v_code, 'name', v_name, 'type', v_type::text, 'names', v_names);
end $$;

create or replace function create_account(p_code text, p_name text, p_type text, p_names jsonb default null,
                                          p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_code', p_code, 'p_name', p_name, 'p_type', p_type, 'p_names', p_names);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'create_account', v_req);
  if v is not null then return v; end if;
  v := create_account__run(p_code => p_code, p_name => p_name, p_type => p_type, p_names => p_names);
  -- The trail names the account by its code; it keeps the name, the class and the other names.
  perform audit_event(v_business, 'account.create', 'gl_account', v ->> 'code', null, null,
                      jsonb_build_object('name', v -> 'name', 'account_type', v -> 'type')
                      || case when v -> 'names' <> '{}' then jsonb_build_object('names', v -> 'names') else '{}' end);
  perform idem_finish(v_business, p_idempotency_key, 'create_account', v_req, v);
  return v;
end $$;

-- =============================================================================
-- 3. An account the café added, renamed
-- =============================================================================
create or replace function rename_account__run(p_code text, p_name text, p_names jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_name text := account_name_ok(p_name);
  a gl_account; v_other gl_account; v_names jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('gl_account:' || v_business::text));
  a := account_to_change(v_business, p_code);
  select * into v_other from gl_account
   where business_id = v_business and id <> a.id and name_key(name) = name_key(v_name);
  if v_other.id is not null then raise exception '% is account % already', v_other.name, v_other.code; end if;
  update gl_account set name = v_name where id = a.id;
  -- Its words in Arabic and Kurdish go with it, where it has none under its new name;
  -- those given here take their place.
  insert into app_phrase (business_id, locale, phrase, words, updated_by)
  select business_id, locale, v_name, words, current_app_user_id()
    from app_phrase
   where business_id = v_business and phrase = a.name and locale in ('ar', 'ckb') and v_name <> a.name
  on conflict (business_id, locale, phrase) do nothing;
  v_names := account_names_save(v_business, v_name, p_names);
  return jsonb_build_object('code', a.code, 'before', jsonb_build_object('name', a.name),
                            'after', jsonb_build_object('name', v_name)
                                     || case when v_names <> '{}' then jsonb_build_object('names', v_names) else '{}' end);
end $$;

create or replace function rename_account(p_code text, p_name text, p_names jsonb default null,
                                          p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_code', p_code, 'p_name', p_name, 'p_names', p_names);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'rename_account', v_req);
  if v is not null then return v; end if;
  v := rename_account__run(p_code => p_code, p_name => p_name, p_names => p_names);
  perform audit_event(v_business, 'account.rename', 'gl_account', v ->> 'code', null, v -> 'before', v -> 'after');
  v := jsonb_build_object('code', v ->> 'code', 'name', v #>> '{after,name}');
  perform idem_finish(v_business, p_idempotency_key, 'rename_account', v_req, v);
  return v;
end $$;

-- =============================================================================
-- 4. An account the café added, taken out of use or brought back
-- =============================================================================
create or replace function set_account_in_use__run(p_code text, p_in_use boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := require_permission('accounting.post');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  a gl_account; v_draft journal_entry;
begin
  if p_in_use is null then raise exception 'Say whether the account is in use'; end if;
  if v_reason is null then raise exception 'Say why'; end if;
  if length(v_reason) > 300 then raise exception 'A reason is at most 300 letters'; end if;
  a := account_to_change(v_business, p_code);
  if a.is_active and p_in_use then raise exception 'Account % % is in use already', a.code, a.name; end if;
  if not a.is_active and not p_in_use then raise exception 'Account % % is out of use already', a.code, a.name; end if;
  if not p_in_use then
    select e.* into v_draft from journal_entry e
     where e.business_id = v_business and e.status = 'draft'
       and exists (select 1 from journal_line l where l.journal_entry_id = e.id and l.account_id = a.id)
     order by e.created_at limit 1;
    if v_draft.id is not null then
      raise exception 'A draft journal (%) has a line on account % %: publish it or change the line first',
        coalesce(v_draft.description, '—'), a.code, a.name;
    end if;
  end if;
  update gl_account set is_active = p_in_use where id = a.id;
  return jsonb_build_object('code', a.code, 'reason', v_reason,
                            'before', jsonb_build_object('name', a.name, 'is_active', a.is_active),
                            'after', jsonb_build_object('name', a.name, 'is_active', p_in_use));
end $$;

create or replace function set_account_in_use(p_code text, p_in_use boolean, p_reason text,
                                              p_idempotency_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := current_business_id();
  v_req jsonb := jsonb_build_object('p_code', p_code, 'p_in_use', p_in_use, 'p_reason', p_reason);
  v jsonb;
begin
  v := idem_begin(v_business, p_idempotency_key, 'set_account_in_use', v_req);
  if v is not null then return v; end if;
  v := set_account_in_use__run(p_code => p_code, p_in_use => p_in_use, p_reason => p_reason);
  perform audit_event(v_business, 'account.in_use', 'gl_account', v ->> 'code', v ->> 'reason',
                      v -> 'before', v -> 'after');
  v := jsonb_build_object('code', v ->> 'code', 'in_use', (v #>> '{after,is_active}')::boolean);
  perform idem_finish(v_business, p_idempotency_key, 'set_account_in_use', v_req, v);
  return v;
end $$;

-- =============================================================================
-- 5. Who may call what
-- =============================================================================
-- The helpers and the bodies are called inside, never by hand.
revoke execute on function
  account_name_ok(text), account_names_save(uuid, text, jsonb), account_to_change(uuid, text),
  create_account__run(text, text, text, jsonb), rename_account__run(text, text, jsonb),
  set_account_in_use__run(text, boolean, text)
  from public, anon, authenticated;
-- Open to signed-in people; each checks accounting.post.
revoke execute on function
  create_account(text, text, text, jsonb, uuid), rename_account(text, text, jsonb, uuid),
  set_account_in_use(text, boolean, text, uuid)
  from public, anon;
grant execute on function
  create_account(text, text, text, jsonb, uuid), rename_account(text, text, jsonb, uuid),
  set_account_in_use(text, boolean, text, uuid)
  to authenticated;
