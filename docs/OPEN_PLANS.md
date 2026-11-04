# Open plans

Plans the owner has kept to decide later. Nothing here is started; each waits
for the owner's word. When the owner asks for "the unfinished plans", this is
the list.

## 1. Supabase and the café's daily use

The owner decides when to talk about it: the plan (Free has no backups; Pro
keeps a daily copy for seven days), a nightly copy kept elsewhere, and
running the café on it day to day. See docs/guides/backup-restore.md.

## 2. Selling the system to other cafés

docs/SELLING_PLAN.md: each café's own data, a new café setting itself up,
the brand, how to charge, support. Decide questions 1, 3 and 4 first, then
one or two friendly cafés.

## 3. Use-by: two gaps (4 November 2026)

What is made on Production has a use-by, a label, warnings (orange within a
day, red past it, on the Dashboard and the phone), oldest sold first, and
markdowns suggested. Two gaps:

1. **The till sells a batch past its use-by without a word** when it is all
   that is left. To decide: the till **warns** the cashier, or **refuses**
   unless a manager approves.
2. **No use-by without a shelf life.** A recipe's "how long it keeps" is
   optional, so a batch of it has no use-by and no warning; bought goods
   (milk, croissants) have none at all. To decide: make the shelf life
   required on recipes, and give a delivery's lines an optional use-by.

## 4. The practice videos in each language (4 November 2026)

The videos of the practice tasks were recorded with the app in English; in
Arabic or Kurdish only the captions change, and the screens in the video stay
English. The fix: record each video three times, with the app in English,
Arabic and Kurdish (right to left for the last two), and play the one in the
person's language, its captions with it. About 11 MB in all instead of 4.
tests/e2e/videos.e2e.mjs already records them; it needs the language set
for each run, and src/lib/help/videos.ts a file per language.
