# Every screen in every language

The app speaks English, Arabic and Kurdish (Sorani), and any language the
owner adds on Settings → Languages. This is how a screen's words reach the
reader in their language, and the rules that keep it so. `tests/i18n.test.ts`
checks them.

## How it works

- **A phrase is its English.** A screen writes `t("Waiting to be paid out")`,
  not a made-up key. The phrase books in `src/lib/i18n/phrases/` give each
  phrase in Arabic and Kurdish: `"Waiting to be paid out": { ar: "…", ckb: "…" }`.
  The older dotted keys (`t("nav.sales")`) in `src/lib/i18n/dictionaries.ts`
  still work.
- **The server gives each page its reader's words only.** The root layout reads
  the language (the switcher's cookie), builds that language's words (built in,
  then the owner's corrections) and hands them to `I18nProvider`. English needs
  no words: a phrase with none shows its English.
- **Messages are translated where they are shown.** An action, a form's check
  or the database answers in English ("Choose the account", "Milk is not in
  stock"). `<Notice>` and `msg()` show it in the reader's language: an exact
  phrase, or a phrase with values, kept with `{1}`, `{2}`… where the values go
  (`"{1} is not in stock"`); each value is itself translated when it is a phrase.

## Writing a screen

| Where                                       | How                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser component (`"use client"`)          | `const { t, msg } = useT();` from `@/lib/i18n/I18nProvider`                                                                                             |
| Server component (a page)                   | `const t = await getT();` (and `getMsg()`) from `@/lib/i18n/server`                                                                                     |
| A sentence with values                      | `t("{n} orders for {name}", { n, name })` — never glue fragments                                                                                        |
| A sentence with bold words or links         | `<Rich text={t("Sits in <b>1100</b> until <guide>paid out</guide>.")} tags={{ guide: (c) => <Link href="/help">{c}</Link> }} />` from `@/lib/i18n/Rich` |
| A label from `@/lib/format`                 | `t(tenderLabel(x))`, `t(roleLabel(r))`, `t(movementLabel(m))`…                                                                                          |
| A message from the server                   | `<Notice msg={…} />` translates it; elsewhere show `msg(text)`                                                                                          |
| `confirm()`, `alert()`                      | `confirm(t("Cancel this bill?"))`                                                                                                                       |
| `aria-label`, `title`, `placeholder`, `alt` | translated like any text                                                                                                                                |

Rules:

1. **The English stays exactly as it was**, to the space and the full stop: the
   end-to-end tests find buttons and headings by their English words. Turning a
   sentence built from pieces into one phrase must render the same English.
2. **One phrase per sentence**, with `{placeholders}` for values, so each
   language puts the words in its own order. Format a value before it goes in
   (`{ amount: fmtIQD(x) }`).
3. **`t` never crosses from the server to the browser**: a function cannot be
   given to a client component. A client component calls `useT()`; a server
   component passes translated strings down, or calls `getT()` itself. A server
   component that is not `async` takes `t` from its parent page.
4. **Not translated**: codes and numbers (account `1100`, `SGC-2026-0001`),
   `IQD`, `CSV`, `PIN`, brand names (Talabat, Lezzoo, Careem, Toters), what the
   café typed itself (product, item, supplier and people's names), `data-testid`,
   `className`, `key`, `href`, form `name`/`value`. A string that must stay the
   same in every language, and that the checker would take for text, is marked
   with an `i18n-ignore` comment on its line or the line before.
5. **CSV downloads keep English column names**, so a spreadsheet or the
   accountant's software reads them the same whoever downloaded them.

## Messages of actions and forms

Everything an action in `src/lib/actions/` or `src/lib/auth/actions.ts` answers
is a phrase: `{ error: "…" }`, `{ message: "…" }`, each zod message
(`.min(1, "Add at least one line")`), and the name given to a field's check
(`positive("The amount")`, `id("a supplier")`, `text("Their name")`), which the
shared checks in `common.ts` put in a sentence ("{1} must be a number greater
than zero", "Choose {1}", "{1} is required").

A message built with values is a phrase with numbered slots in the order the
values appear: `` `${name} is not in stock` `` is the phrase `"{1} is not in
stock"`. It needs at least six letters of its own around the slots, or it
would match other messages.

## The phrase books

- `common.ts`: what every screen shares (Save, Cancel, Date, Amount, Cash,
  roles, movements, days and months, form checks, the database's general
  answers). An area's book never repeats one of these.
- One book per area: `books` (Journals, Accounting, Expenses), `sales` (Sales,
  the drawer, card takings, Vendors), `stock` (Inventory, receiving, the count,
  Purchasing), `reports` (Reports, Orders, the audit trail, the dashboard),
  `menu` (Products & Recipes, Production), `platforms` (Delivery Platforms,
  statements, settlements), `settings` (Settings, people, signing in, the
  till's messages, approvals), `db` (the database's messages, alerts and the
  daily brief).
- Each phrase has its Arabic and its Kurdish, with every `{placeholder}` and
  `<tag>` of the English; a phrase repeated in two books is translated the same.

## The words

- **Arabic**: Modern Standard Arabic as it is written in Iraq, short and plain,
  for café staff at a counter.
- **Kurdish**: Sorani (Central Kurdish) in Arabic script, as written in Erbil
  and Sulaymaniyah.
- The same thing is called the same everywhere; follow `common.ts` and the
  dotted keys in `dictionaries.ts` (journal: قيد / تۆمار; account: حساب /
  هەژمار; supplier: مورّد / دابینکەر; stock: مخزون / کۆگا; drawer: درج النقد /
  دەخیلە).
- A count reads right for any number: English keeps "{n} day(s)"; Arabic and
  Kurdish may say it as "الأيام: {n}" or with the plural a screen normally uses.

## Checking

```sh
node scripts/i18n-scan.mjs                 # what is left, counted by screen
node scripts/i18n-scan.mjs src/app/sales   # each finding under a path
npx vitest run tests/i18n.test.ts
```

The scanner finds text between tags, strings in read attributes, a string in
braces (alone, in `?:`, `&&`, `||`), a template's words, `confirm()`/`alert()`,
and `label:`/`title:`/`message:`-like properties. It is a floor, not a ceiling:
a string kept in a variable and shown later is found by reading the screen.
