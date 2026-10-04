// Every screen in the reader's language, and languages the owner adds (release
// G, 0032), through the real screens: in Arabic and in Kurdish each screen
// shows no English but the café's own names; the owner adds Turkish, gives it
// words, and every page speaks it; corrects a built-in Arabic word and takes it
// back; writes an Arabic count's forms; adds Persian, written right to left;
// takes Turkish out of use; hands a translator the words as a CSV and takes
// them back. A cashier cannot.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();

const SCREENS = [
  "/dashboard",
  "/pos",
  "/start-of-day",
  "/end-of-day",
  "/sales",
  "/sales/sessions",
  "/platforms",
  "/vendors",
  "/expenses",
  "/purchasing",
  "/purchasing/buying-list",
  "/orders",
  "/products",
  "/inventory",
  "/inventory/usage",
  "/count",
  "/production",
  "/staff",
  "/payroll",
  "/customers",
  "/journals",
  "/accounting",
  "/reports",
  "/reports/sales",
  "/reports/stock",
  "/reports/statements",
  "/audit",
  "/settings",
  "/settings/rules",
  "/settings/languages",
  "/account",
];

console.log("▸ every screen in Arabic and in Kurdish, not only the menu");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  const left = [];
  for (const path of SCREENS) {
    await open(page, path);
    const words = await english(page, path);
    if (words.length) left.push(`${path}: ${words.slice(0, 12).join(" ")}`);
  }
  check(
    left.length === 0,
    `every screen in ${locale} shows no English but the café's own names` +
      (left.length ? `\n      ${left.join("\n      ")}` : ""),
  );
  await ctx.close();
}

console.log("▸ a cashier cannot change the café's languages");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/settings/languages");
  check(!page.url().includes("/settings/languages"), "a cashier opening Languages is taken home");
  await ctx.close();
}

console.log("▸ the owner adds Turkish, and gives it words");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings/languages");
  const add = page.getByTestId("add-language");
  await add.getByLabel("Code").fill("tr");
  await add.getByLabel("Name, as its speakers write it").fill("Türkçe");
  await add.getByRole("button", { name: "Add the language" }).click();
  await page
    .getByText("Türkçe is added: it is in the language menu now.")
    .waitFor({ timeout: 10000 });
  await page.waitForURL((u) => u.search.includes("lang=tr"));
  await page.waitForLoadState("networkidle");
  check(
    (
      await page.getByLabel("Language", { exact: true }).locator("option").allTextContents()
    ).includes("Türkçe"),
    "added, and offered in the language menu",
  );
  const words = page.locator("#words");
  check(
    (await words.getByRole("heading").textContent()) === "Words in Türkçe",
    "its words are open, ready to be given",
  );
  await words.getByLabel("Search").fill("Languages");
  await words.getByLabel("Words for: Languages", { exact: true }).fill("Diller");
  // The menu's "Sales" is kept by its key; the phrase "Sales" is another row.
  await words.getByLabel("Search").fill("nav.sales");
  await words.getByLabel("Words for: Sales", { exact: true }).fill("Satışlar");
  await words.getByRole("button", { name: "Save 2 changes" }).click();
  await page
    .getByText("Saved: 2 phrases with new words, 0 back to the built-in words.")
    .waitFor({ timeout: 10000 });
  check(true, "the owner gives two phrases their Turkish");
  check(
    sql(
      `select string_agg(phrase || '=' || words, ', ' order by phrase) from app_phrase where locale = 'tr'`,
    ) === "Languages=Diller, nav.sales=Satışlar",
    "kept by the phrase's English, or its key",
  );

  // Chosen in the language menu, every page speaks it.
  await page.getByLabel("Language", { exact: true }).selectOption("tr");
  // Choosing a language reloads the page: wait for the one in Turkish.
  await page.waitForSelector('html[lang="tr"]');
  await page.waitForLoadState("networkidle");
  check(
    (await page.locator("html").getAttribute("lang")) === "tr" &&
      (await page.locator("html").getAttribute("dir")) === "ltr",
    "the page is in Turkish, left to right",
  );
  check((await page.locator("h1").textContent()) === "Diller", "its heading in Turkish");
  check(
    await page.locator(".sidenav").getByRole("link", { name: "Satışlar" }).isVisible(),
    "and the menu too",
  );
  check(
    await page.getByRole("heading", { name: "The café's languages" }).isVisible(),
    "a phrase with no Turkish yet shows its English",
  );

  // The translator's file: every phrase, with its words, out and back in.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#words").getByRole("button", { name: "Download CSV" }).click(),
  ]);
  const file = await download.path();
  const { readFileSync, writeFileSync } = await import("node:fs");
  const csv = readFileSync(file, "utf8");
  check(
    csv.startsWith("﻿key,english,built_in,words") && csv.includes("Languages,Languages,,Diller"),
    "downloaded, every phrase with its words",
  );
  const back = `${file}.csv`;
  writeFileSync(back, "key,english,built_in,words\r\nnav.dashboard,Dashboard,,Gösterge paneli\r\n");
  await page.locator("#words input[type=file]").setInputFiles(back);
  await page.getByText("Read 1 phrase with new words from the file.").waitFor();
  await page.locator("#words").getByRole("button", { name: "Save 1 change" }).click();
  await page.getByText("Saved: 1 phrase with new words, 0 back to the built-in words.").waitFor();
  // Saved, the page is refreshed: wait for the menu to be given the new words.
  const uploaded = await page
    .locator(".sidenav")
    .getByRole("link", { name: "Gösterge paneli" })
    .waitFor({ timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  check(uploaded, "and the translator's words, uploaded, are on every page");
  await ctx.close();
}

console.log("▸ a better Arabic word, and back to the built-in one");
{
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: "ar", url: BASE }]);
  await open(page, "/settings/languages?lang=ar");
  check((await page.locator("h1").textContent()) === "اللغات", "Languages, in Arabic");
  const words = page.locator("#words");
  await words.getByLabel("بحث").fill("Languages");
  await words.getByLabel("الكلمات لـ: Languages", { exact: true }).fill("لغات التطبيق");
  await words.getByRole("button", { name: "حفظ التغييرات (1)" }).click();
  await page.waitForLoadState("networkidle");
  await page.locator("h1", { hasText: "لغات التطبيق" }).waitFor({ timeout: 10000 });
  check(true, "the owner's Arabic word replaces the built-in one");
  await words.getByLabel("بحث").fill("Languages");
  await words.getByLabel("الكلمات لـ: Languages", { exact: true }).fill("");
  await words.getByRole("button", { name: "حفظ التغييرات (1)" }).click();
  await page.waitForLoadState("networkidle");
  await page.locator("h1", { hasText: /^اللغات$/ }).waitFor({ timeout: 10000 });
  check(true, "and cleared, the built-in word is back");
  await ctx.close();
}

console.log("▸ an Arabic count in the café's own words");
{
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: "ar", url: BASE }]);
  await open(page, "/settings/languages?lang=ar");
  const words = page.locator("#words");
  const phrase = "Page {page} of {pages} · {n} phrase(s)";
  const forms =
    "صفحة {page} من {pages} · {n, plural, one {عبارة واحدة} two {عبارتان} few {# عبارات} other {# عبارة}}";
  // The form Arabic gives n phrases.
  const counted = (n) =>
    ({ one: "عبارة واحدة", two: "عبارتان", few: `${n} عبارات` })[
      new Intl.PluralRules("ar").select(n)
    ] ?? `${n} عبارة`;
  await words.getByLabel("بحث").fill("Page {page} of {pages}");
  const box = words.locator("tbody textarea").first();
  await box.fill(forms);
  await words.getByRole("button", { name: "حفظ التغييرات (1)" }).click();
  await page.waitForLoadState("networkidle");
  const one = await words
    .getByText("صفحة 1 من 1 · عبارة واحدة", { exact: true })
    .waitFor({ timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  check(one, "the owner writes a count's forms, and one phrase found reads «عبارة واحدة»");
  check(
    sql(
      `select position(chr(8291) in words) > 0 from app_phrase where locale = 'ar' and phrase = '${phrase}'`,
    ) === "t",
    "kept in the form the database's check reads",
  );
  check((await box.inputValue()) === forms, "and given back to edit as they were written");
  await words.getByLabel("بحث").fill("saved:");
  const n = await words.locator("tbody tr").count();
  check(
    n > 2 && (await words.getByText(`صفحة 1 من 1 · ${counted(n)}`, { exact: true }).isVisible()),
    `${n} phrases found take the form Arabic gives ${n}`,
  );
  await words.getByLabel("بحث").fill("Page {page} of {pages}");
  await words.locator("tbody textarea").first().fill("");
  await words.getByRole("button", { name: "حفظ التغييرات (1)" }).click();
  await page.waitForLoadState("networkidle");
  const back = await words
    .getByText("الصفحة 1 من 1 · العبارات: 1", { exact: true })
    .waitFor({ timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  check(
    back &&
      sql(`select count(*) from app_phrase where locale = 'ar' and phrase = '${phrase}'`) === "0",
    "cleared, the built-in words are back",
  );
  await ctx.close();
}

console.log("▸ Persian, written right to left; Turkish taken out of use");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings/languages");
  const add = page.getByTestId("add-language");
  await add.getByLabel("Code").fill("fa");
  await add.getByLabel("Name, as its speakers write it").fill("فارسی");
  await add.getByLabel("Written").selectOption("rtl");
  await add.getByRole("button", { name: "Add the language" }).click();
  await page.getByText("فارسی is added").waitFor({ timeout: 10000 });
  await page.getByLabel("Language", { exact: true }).selectOption("fa");
  await page.waitForSelector('html[lang="fa"]');
  await page.waitForLoadState("networkidle");
  check(
    (await page.locator("html").getAttribute("dir")) === "rtl" &&
      (await page.locator("html").getAttribute("lang")) === "fa",
    "a page in Persian is right to left",
  );
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check(over <= 1, "and fits the screen");

  await ctx.addCookies([{ name: "locale", value: "en", url: BASE }]);
  await open(page, "/settings/languages");
  await page.getByTestId("language-tr").getByRole("button", { name: "Take out of use" }).click();
  await page.getByText("Türkçe is out of use").waitFor({ timeout: 10000 });
  await ctx.addCookies([{ name: "locale", value: "tr", url: BASE }]);
  await open(page, "/dashboard");
  check(
    (await page.locator("html").getAttribute("lang")) === "en" &&
      !(
        await page.getByLabel("Language", { exact: true }).locator("option").allTextContents()
      ).includes("Türkçe"),
    "out of use, Turkish leaves the menu, and a reader who had it sees English",
  );
  check(
    sql(`select count(*) from app_phrase where locale = 'tr'`) === "3",
    "its words are kept for when it comes back",
  );
  check(
    sql(
      `select string_agg(action, ',' order by id) from audit_log where action like 'language.%'`,
    ) ===
      "language.add,language.words,language.words,language.words,language.words,language.words,language.words,language.add,language.update",
    "every language added or changed, and every change of words, is on the audit trail",
  );
  await ctx.close();
}

await browser.close();
done("languages");
