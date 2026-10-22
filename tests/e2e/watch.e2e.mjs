// The watch list (0094, SMART_PLAN part 2) through the real screens: a
// cashier gives a 9% "regular customer" discount on two sales a day for four
// weeks, the other cashier at the same hours none. The owner's Dashboard says
// something is worth a look; Reports leads to the watch list, which names the
// cashier, the evidence and how unusual it is; the owner marks it explained
// with a note. A manager cannot open it; Settings lets only the owner say who
// reads it; Arabic and Kurdish. (Run just before the café is cleared: its
// sales are written straight in.)
import { BASE, TODAY, chromium, check, done, open, signIn, sql } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";

sql(`insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000e2e1', 'e2e.ana@example.com')
       on conflict do nothing;
     insert into app_user (business_id, full_name, email, auth_user_id)
     values ('${B}', 'E2E Ana', 'e2e.ana@example.com', 'a0000000-0000-0000-0000-00000000e2e1') on conflict do nothing;
     insert into user_role (app_user_id, role) select id, 'cashier' from app_user where email = 'e2e.ana@example.com'
       on conflict do nothing;`);
// Four weeks of mornings for Ana and the demo cashier (and a sale each two
// months ago: they are not new).
sql(`set session_replication_role = replica;
     with plan as (
       select d, w from generate_series(1, 27) d cross join unnest(array['E2E Ana', 'Demo Cashier']) w
       union all select 60, w from unnest(array['E2E Ana', 'Demo Cashier']) w)
     insert into sales_order (business_id, location_id, channel, status, idempotency_key, gross_amount, net_amount,
                              cashier_id, placed_at, discount_percent, discount_reason)
     select '${B}', default_location('${B}'), 'dine_in', 'completed', gen_random_uuid(), 4000, 4000,
            (select id from app_user where business_id = '${B}' and full_name = p.w),
            ((${TODAY} - p.d)::timestamp + time '10:00' + make_interval(mins => k)) at time zone 'Asia/Baghdad',
            case when p.w = 'E2E Ana' and k <= 2 and p.d <= 27 then 9 end,
            case when p.w = 'E2E Ana' and k <= 2 and p.d <= 27 then 'Regular customer' end
       from plan p cross join generate_series(1, case when p.d = 60 then 1 else 10 end) k;`);
sql(`delete from watch_state where business_id = '${B}'`);

console.log("▸ the owner's Dashboard: something worth a look");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/dashboard");
  const card = page.getByTestId("dash-watch");
  await card.waitFor({ timeout: 15000 });
  check(
    (await card.textContent()).includes("1 thing worth a look"),
    "one thing worth a look, no name on it",
  );
  await ctx.close();
}

console.log("▸ Reports leads to the watch list: who, the evidence, how unusual");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/reports");
  await page.getByTestId("to-watch").click();
  await page.waitForURL(/\/reports\/watch/);
  const finding = page.locator(
    '[data-testid="watch-finding"][data-person="E2E Ana"][data-kind="discounts"]',
  );
  await finding.waitFor({ timeout: 15000 });
  const said = (await finding.textContent()) ?? "";
  check(
    said.includes("E2E Ana: discounts just under the limit, again and again") &&
      said.includes("54 discounts of 8–10% (Regular customer) in 270 sales") &&
      said.includes("by luck"),
    `Ana's discounts, with the evidence: ${said.slice(0, 160)}`,
  );
  await finding
    .getByLabel("A note (on the audit trail)")
    .fill("The regulars' discount, agreed with me");
  await finding.getByRole("button", { name: "Explained" }).click();
  await page.getByTestId("watch-settled").waitFor({ timeout: 15000 });
  check(
    (await page.getByTestId("watch-settled").textContent()).includes("explained"),
    "marked explained: kept under what was settled",
  );
  check(
    sql(`select status || ' ' || note from watch_finding f join app_user u on u.id = f.app_user_id
          where u.full_name = 'E2E Ana'`) === "explained The regulars' discount, agreed with me",
    "kept with the note",
  );
  await ctx.close();
}

console.log("▸ a manager cannot open it; Settings lets only the owner say who reads it");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/reports/watch");
  check(
    (await page.getByTestId("watch-open").count()) === 0 && !page.url().includes("/reports/watch"),
    "a manager is sent back to Reports",
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings#rules");
  check(
    (await page.getByTestId("watch-visibility").count()) === 1,
    "the owner says whether the general manager reads it",
  );
  await ctx.close();
}

console.log("▸ the watch list in Arabic and Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  await open(page, "/reports/watch");
  const words = await english(page, "/reports/watch");
  check(
    words.length === 0,
    `in ${locale}, no English but the café's own names` +
      (words.length ? `: ${words.slice(0, 12).join(" ")}` : ""),
  );
  await ctx.close();
}

await browser.close();
done("watch");
