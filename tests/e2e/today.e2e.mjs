// Today (the sales round): everyone starts on their own jobs for the day, in
// the order of the day, each with one button to where it is done and each
// ticked once it is. The cashier lands on Today with the drawer alone, and
// its button opens the till. The counter's count, started, is theirs to do
// and its button opens Stock Count; sent, it waits on someone else, and the
// owner has it to check; approved, the counter is all done for now. The
// owner lands on Today with the managers' jobs and not the auditor's, what is
// to do first and what is done last, and each button goes where it says.
// Today is first in everyone's menu, and in Arabic and Kurdish.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const B = "00000000-0000-0000-0000-0000000000b1";
const CUP = "c0000000-0000-0000-0000-000000000002";
const RANK = { todo: 0, waiting: 1, later: 2, done: 3 };

/** Where a sign-in lands, once the home page has sent them on. */
async function landed(page) {
  await page.waitForURL((u) => u.pathname !== "/" && !u.pathname.startsWith("/login"), {
    timeout: 15000,
  });
  return new URL(page.url()).pathname;
}

/** The jobs on Today, in the order shown: each one's key, state, sentence and button. */
async function jobs(page) {
  await page.getByTestId("today-progress").waitFor({ timeout: 15000 });
  return page.locator("li[data-job]").evaluateAll((els) =>
    els.map((e) => {
      const go = e.querySelector('[data-testid="today-job-go"]');
      return {
        key: e.getAttribute("data-job"),
        state: e.getAttribute("data-state"),
        say: e.querySelector('[data-testid="today-job-say"]')?.textContent ?? "",
        href: go?.getAttribute("href") ?? null,
        label: go?.textContent ?? "",
        buttons: e.querySelectorAll('[data-testid="today-job-go"]').length,
      };
    }),
  );
}

/** A job's one button, followed. */
async function follow(page, key) {
  const go = page.locator(`li[data-job="${key}"] [data-testid="today-job-go"]`);
  const href = await go.getAttribute("href");
  await Promise.all([
    page.waitForURL((u) => `${u.pathname}${u.hash}` === href || u.pathname === href.split("#")[0], {
      timeout: 15000,
    }),
    go.click(),
  ]);
  await page.waitForLoadState("networkidle");
  return { href, at: new URL(page.url()).pathname };
}

const menuOf = (page) =>
  page.$$eval("nav.sidenav a", (as) => as.map((a) => a.getAttribute("href")));

// No count left open from a suite before: one place counts once at a time.
sql(`select test.act_as('owner@example.com');
     select cancel_stock_count(id, 'Left open before Today') from stock_count
      where business_id = '${B}' and status = 'counting'`);

console.log("▸ the cashier");
{
  const { ctx, page } = await signIn(browser, "cashier");
  check((await landed(page)) === "/today", "the cashier starts on Today");
  const menu = await menuOf(page);
  check(menu[0] === "/today", `Today is first in the menu (${menu.join(" ")})`);
  const list = await jobs(page);
  check(
    JSON.stringify(list.map((j) => j.key)) === JSON.stringify(["drawer"]),
    `the drawer is their one job, nothing of a manager's (${list.map((j) => j.key).join(", ")})`,
  );
  const drawer = list[0];
  check(drawer?.buttons === 1 && drawer.href === "/pos", "with one button, to the till");
  check(
    (drawer?.state === "todo" && drawer.label === "Open the drawer") ||
      (drawer?.state === "done" && drawer.say.startsWith("Open since") && drawer.label === "Sell"),
    `closed, to open; open, done and selling (${drawer?.state}: ${drawer?.say})`,
  );
  const { at } = await follow(page, "drawer");
  check(at === "/pos", "and the button opens the till");
  await ctx.close();
}

console.log("▸ the counter");
const countId = last(`select test.act_as('counter@example.com');
                      select start_stock_count(array['${CUP}'::uuid])`);
{
  const { ctx, page } = await signIn(browser, "counter");
  check((await landed(page)) === "/today", "the counter starts on Today");
  const list = await jobs(page);
  check(
    JSON.stringify(list.map((j) => j.key)) === JSON.stringify(["count"]),
    `the count is their one job (${list.map((j) => j.key).join(", ")})`,
  );
  check(
    list[0]?.state === "todo" && list[0].say.startsWith("Your count is open: 0 of 1"),
    `their open count is to do (${list[0]?.say})`,
  );
  check((await page.getByTestId("today-all-done").count()) === 0, "so it is not all done");
  const { at } = await follow(page, "count");
  check(at === "/count", "and its button opens Stock Count");

  // Counted at what is there, and sent: it waits on someone else.
  // What is there, read as the database's own (a counter may not ask it).
  const onShelf = last(
    `select trim_scale((item_position('${B}', '${CUP}', default_location('${B}'))).qty)`,
  );
  sql(`select test.act_as('counter@example.com');
       select record_count('${countId}', '${CUP}', ${onShelf});
       select submit_stock_count('${countId}')`);
  await open(page, "/today");
  const sent = await jobs(page);
  check(sent[0]?.state === "waiting", `sent, it waits on someone else (${sent[0]?.say})`);
  check(
    (await page.getByTestId("today-all-done").count()) === 1,
    "and nothing is left for them to do now",
  );
  await ctx.close();
}

console.log("▸ the owner");
{
  const { ctx, page } = await signIn(browser, "owner");
  check((await landed(page)) === "/today", "the owner starts on Today");
  const list = await jobs(page);
  const keys = list.map((j) => j.key);
  console.log(`    jobs: ${list.map((j) => `${j.key}:${j.state}`).join(" ")}`);
  check(
    ["approvals", "problems", "endDay"].every((k) => keys.includes(k)) &&
      !keys.includes("books") &&
      !keys.includes("audit"),
    "the managers' jobs, not the auditor's",
  );
  check(
    list.every((j, i) => i === 0 || RANK[list[i - 1].state] <= RANK[j.state]),
    "what is to do first, then what waits, then what is for later, then what is done",
  );
  check(
    list.every((j) => j.buttons === 1 && j.href?.startsWith("/")),
    "each job has one button",
  );
  const count = list.find((j) => j.key === "count");
  check(
    count?.state === "todo" &&
      count.href === "/count" &&
      /^\d+ counts? to check\.$/.test(count.say),
    `the counter's count is theirs to check (${count?.say})`,
  );
  const { at } = await follow(page, "count");
  check(at === "/count", "and its button opens Stock Count");
  await open(page, "/today");
  const problems = await follow(page, "problems");
  check(problems.at === "/problems", "the problems' button opens what was reported");
  await open(page, "/today");
  const close = await follow(page, "endDay");
  check(close.at === "/end-of-day", "and the close's, End of Day");
  await ctx.close();
}

// Checked by a manager: nothing differs, so nothing moves.
sql(`select test.act_as('manager@example.com'); select approve_stock_count('${countId}')`);

console.log("▸ the counter, once the count is approved");
{
  const { ctx, page } = await signIn(browser, "counter");
  await landed(page);
  const list = await jobs(page);
  check(
    list[0]?.state === "later" && list[0].href === "/count",
    `a new count is for later, when they are asked (${list[0]?.say})`,
  );
  check(await page.getByTestId("today-all-done").isVisible(), "and the page says all done for now");
  await ctx.close();
}

console.log("▸ in Arabic and Kurdish");
for (const [locale, title, dir] of [
  ["ar", "اليوم", "rtl"],
  ["ckb", "ئەمڕۆ", "rtl"],
]) {
  const { ctx, page } = await signIn(browser, "cashier");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  await open(page, "/today");
  const h1 = (await page.locator("h1").textContent())?.trim();
  const say = (await page.getByTestId("today-job-say").first().textContent()) ?? "";
  check(
    h1 === title &&
      (await page.locator("html").getAttribute("dir")) === dir &&
      !/[A-Za-z]{2,}/.test(say),
    `${locale}: the page and its jobs in the reader's language (${h1}: ${say})`,
  );
  await ctx.close();
}

await browser.close();
done("today");
