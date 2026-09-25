-- =============================================================================
-- Languages the café adds, and its own words for any phrase (0032): the owner
-- adds a language, names it and says which way it is written; gives phrases
-- their words in it, or corrects the built-in Arabic and Kurdish; every page
-- reads the café's languages and one language's words; a language taken out
-- of use leaves the pages, its words kept. Every change is on the audit trail.
-- =============================================================================

-- Only the owner or general manager changes the café's languages.
select test.act_as('cashier@example.com');
select test.throws($$select save_language('tr', 'Türkçe')$$, '%permission%', 'a cashier cannot add a language');
select test.throws($$select save_phrases('ar', '{"Save": "احفظ"}')$$, '%permission%', 'nor change its words');
select test.throws($$select language_settings()$$, '%permission%', 'nor see Settings → Languages');
select test.eq(app_words('ar'), '{"languages": [], "phrases": {}}'::jsonb,
  'every page reads the languages and words: none added yet');

select test.act_as('owner@example.com');
select test.throws($$select save_language('ar', 'Arabic')$$, '%built in%', 'Arabic is built in: it is not added');
select test.throws($$select save_language('Turkish', 'Türkçe')$$, '%two or three small Latin letters%',
  'a code is as the world writes it');
select test.throws($$select save_language('tr', '  ')$$, '%Name the language%', 'a language has a name');
select test.throws($$select save_language('tr', 'Türkçe', 'up')$$, '%left to right%', 'and is written one way or the other');

select test.eq(save_language(' TR ', ' Türkçe '), '{"code": "tr", "name": "Türkçe", "dir": "ltr", "is_active": true}'::jsonb,
  'the owner adds Turkish');
select test.eq(save_language('fa', 'فارسی', 'rtl') ->> 'dir', 'rtl', 'and Persian, written right to left');
select test.eq(app_words('tr') -> 'languages',
  '[{"code": "tr", "name": "Türkçe", "dir": "ltr"}, {"code": "fa", "name": "فارسی", "dir": "rtl"}]'::jsonb,
  'both are offered to every page, in the order they were added');

-- Words: a whole language, or a correction to a built-in one.
select test.throws($$select save_phrases('de', '{"Save": "Speichern"}')$$, '%Add the language%',
  'words are given only in a language the café has');
select test.throws($$select save_phrases('tr', '["Save"]')$$, '%{"phrase": "words"}%', 'as phrase and words');
select test.throws($$select save_phrases('tr', '{"{n} orders for {name}": "{n} sipariş"}')$$,
  '%Keep {n} {name}%', 'the words keep every {placeholder} of the English');
select test.throws($$select save_phrases('tr', '{"Save": 5}')$$, '%as text%', 'and are text');
select test.eq(save_phrases('tr', '{"Save": "Kaydet", "{n} orders for {name}": "{name} için {n} sipariş", "nav.sales": "Satışlar"}'),
  '{"set": 3, "cleared": 0}'::jsonb, 'the owner gives Turkish words, dotted keys and all');
select test.eq(save_phrases('ar', '{"Save": "احفظ"}'), '{"set": 1, "cleared": 0}'::jsonb,
  'and corrects a built-in Arabic word');
select test.eq(save_phrases('tr', '{"Save": "Kaydet"}'), '{"set": 0, "cleared": 0}'::jsonb,
  'words that are already so change nothing');
select test.eq(app_words('tr') -> 'phrases',
  '{"Save": "Kaydet", "nav.sales": "Satışlar", "{n} orders for {name}": "{name} için {n} sipariş"}'::jsonb,
  'a page in Turkish is given its words');
select test.eq(app_words('AR') -> 'phrases', '{"Save": "احفظ"}'::jsonb, 'and one in Arabic its correction');
select test.eq(app_words('fa') -> 'phrases', '{}'::jsonb, 'a language with no words yet shows its English');

select test.act_as('cashier@example.com');
select test.eq(app_words('tr') -> 'phrases' ->> 'Save', 'Kaydet', 'every member reads them');

-- Clearing words gives the phrase back its built-in words, or its English.
select test.act_as('owner@example.com');
select test.eq(save_phrases('ar', '{"Save": "", "Cancel": null}'), '{"set": 0, "cleared": 1}'::jsonb,
  'empty words clear a correction');
select test.eq(app_words('ar') -> 'phrases', '{}'::jsonb, 'and Arabic has its built-in word again');
select test.throws($$select save_phrases('tr', jsonb_build_object('Save', repeat('x', 4001)))$$, '%too long%',
  'words are at most 4000 letters');

-- A language taken out of use leaves the pages; its words are kept for when it comes back.
select test.eq(save_language('fa', 'فارسی', 'rtl', false) ->> 'is_active', 'false', 'the owner takes Persian out of use');
select test.eq(jsonb_array_length(app_words('fa') -> 'languages'), 1, 'it is no longer offered');
select test.eq(save_language('tr', 'Türkçe', 'ltr', false) ->> 'is_active', 'false', 'nor Turkish');
select test.eq(app_words('tr'), '{"languages": [], "phrases": {}}'::jsonb, 'and its words are not given out');
select test.eq(save_language('tr', 'Türkçe (TR)') ->> 'is_active', 'true', 'brought back and renamed');
select test.eq(app_words('tr') -> 'phrases' ->> 'Save', 'Kaydet', 'with its words');

select test.eq((select jsonb_agg(x - 'created_at') from jsonb_array_elements(language_settings() -> 'languages') x),
  '[{"code": "tr", "name": "Türkçe (TR)", "dir": "ltr", "is_active": true},
    {"code": "fa", "name": "فارسی", "dir": "rtl", "is_active": false}]'::jsonb,
  'Settings lists every language added, in use or not');
select test.eq(language_settings() -> 'own_words', '{"tr": 3}'::jsonb, 'and how many phrases have the café''s own words');

-- Nobody writes the tables but through these; every change is on the audit trail.
select test.throws($$insert into app_phrase (business_id, locale, phrase, words)
                     values ('00000000-0000-0000-0000-0000000000b1', 'tr', 'x', 'y')$$,
  '%permission denied%', 'a signed-in person cannot write the words directly');
select test.throws($$select * from app_language$$, '%permission denied%', 'nor read the languages directly');
select test.as_admin();
select test.eq((select string_agg(action || ' ' || entity_id, ', ' order by id) from audit_log where action like 'language.%'),
  'language.add tr, language.add fa, language.words tr, language.words ar, language.words ar, language.update fa, language.update tr, language.update tr',
  'every language added or changed, and every change of words, is audited');
select test.eq((select after_state from audit_log where action = 'language.words' order by id limit 1),
  '{"set": 3, "cleared": 0}'::jsonb, 'with how many phrases changed');
