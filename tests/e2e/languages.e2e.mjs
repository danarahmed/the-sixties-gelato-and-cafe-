// Every screen in the reader's language, and languages the owner adds (release
// G, 0032), through the real screens: in Arabic and in Kurdish each screen
// shows no English but the café's own names; the owner adds Turkish, gives it
// words, and every page speaks it; corrects a built-in Arabic word and takes it
// back; adds Persian, written right to left; takes Turkish out of use; hands a
// translator the words as a CSV and takes them back. A cashier cannot.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();

// What stays in Latin letters in every language: what the café typed itself
// (its products, items, suppliers, people, places, tables, platforms), codes,
// units and the currency.
const typed = sql(`
  select string_agg(n, E'\\n') from (
    select name as n from product union select name from product_variant
    union select name from item union select name from supplier
    union select full_name from app_user union select email from app_user
    union select name from location union select name from dining_table
    union select name from product_category union select name from delivery_platform
    union select name from business union select code from item_unit union select label from item_unit
    union select coalesce(prep_instructions, '') from recipe union select coalesce(note, '') from recipe_version
    union select external_order_id from platform_order union select coalesce(settlement_reference, '') from platform_order
    union select coalesce(contact, '') from supplier union select unnest(allergens) from product
    union select coalesce(sku, '') from item
    union select description from journal_entry where description like '%(fixture)%'
    union select name from recipe union select invoice_no from purchase_invoice
    union select coalesce(note, '') from goods_receipt union select description from journal_entry where reference_type = 'manual'
    union select coalesce(reason, '') from audit_log
  ) x where n is not null`);
const OWN = new Set(
  typed
    .split("\n")
    .flatMap((n) => n.match(/[A-Za-z][A-Za-z'’-]+/g) ?? [])
    .map((w) => w.toLowerCase()),
);
const SAME = new Set(
  [
    "IQD",
    "CSV",
    "PIN",
    "SGC",
    "ml",
    "kg",
    "pcs",
    "each",
    "Talabat",
    "Lezzoo",
    "Careem",
    "Toters",
    // Language codes, as the Languages screen gives them for examples.
    "tr",
    "fa",
    "kmr",
    "ltr",
    "rtl",
    // A language's name is written in itself in the language menu.
    "English",
    // The test fixtures' own records (an opening stock typed "fixture").
    "fixture",
  ].map((w) => w.toLowerCase()),
);
// On Delivery Platforms, the column names of a platform's own report, which
// the statement reader looks for as the platform writes them.
const SAME_ON = { "/platforms": ["order", "payout", "commission", "fees", "id"] };

/** The English words a screen shows that are not the café's own names. */
async function english(page) {
  const text = await page.evaluate(() => {
    const out = [];
    const walk = (n) => {
      if (n.nodeType === Node.TEXT_NODE) out.push(n.textContent);
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const el = n;
      if (["SCRIPT", "STYLE", "CODE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName)) return;
      // Written in English on purpose: the Languages screen's English column,
      // and its table of phrases, whose boxes show the English until given words.
      if (el.getAttribute("lang") === "en") return;
      // Codes, marked as such (a permission's code).
      if (el.getAttribute("translate") === "no") return;
      if (el.tagName === "TABLE" && el.closest("#words")) return;
      if (el.hidden || getComputedStyle(el).display === "none") return;
      for (const attr of ["placeholder", "title", "aria-label"])
        if (el.getAttribute(attr)) out.push(el.getAttribute(attr));
      el.childNodes.forEach(walk);
    };
    walk(document.body);
    return out.join("\n");
  });
  // A word is English when it is all Latin letters: "Türkçe" or "Kaydet" is not
  // taken for it.
  const words = (text.match(/[\p{L}'’-]+/gu) ?? []).filter(
    (w) =>
      /^[A-Za-z]['’A-Za-z-]*[A-Za-z]$/.test(w) &&
      // Not a piece of an id ("3fa9c2e1…") nor initials or a code (GC, TLB).
      !/^[a-f]{1,4}$/.test(w) &&
      !/^[A-Z]{2,3}(-[A-Z])?$/.test(w),
  );
  return [...new Set(words.filter((w) => !OWN.has(w.toLowerCase()) && !SAME.has(w.toLowerCase())))];
}

const SCREENS = [
  "/dashboard",
  "/pos",
  "/sales",
  "/platforms",
  "/vendors",
  "/expenses",
  "/purchasing",
  "/orders",
  "/products",
  "/inventory",
  "/count",
  "/production",
  "/journals",
  "/accounting",
  "/reports",
  "/audit",
  "/settings",
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
    const words = (await english(page)).filter(
      (w) => !(SAME_ON[path] ?? []).includes(w.toLowerCase()),
    );
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
  await words.getByRole("button", { name: "Save 2 change(s)" }).click();
  await page
    .getByText("Saved: 2 phrase(s) with new words, 0 back to the built-in words.")
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
  await page.getByText("Read 1 phrase(s) with new words from the file.").waitFor();
  await page.locator("#words").getByRole("button", { name: "Save 1 change(s)" }).click();
  await page
    .getByText("Saved: 1 phrase(s) with new words, 0 back to the built-in words.")
    .waitFor();
  await page.waitForLoadState("networkidle");
  check(
    await page.locator(".sidenav").getByRole("link", { name: "Gösterge paneli" }).isVisible(),
    "and the translator's words, uploaded, are on every page",
  );
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
      "language.add,language.words,language.words,language.words,language.words,language.add,language.update",
    "every language added or changed, and every change of words, is on the audit trail",
  );
  await ctx.close();
}

await browser.close();
done("languages");
