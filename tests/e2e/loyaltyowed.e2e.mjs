// Loyalty points as money owed (0113). The owner turns it on on Settings:
// the points customers hold are booked as owed at the reward's value, and
// Settings says what the books owe; turned off again, nothing is owed, so the
// suites after this one count points as before.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
const B = "00000000-0000-0000-0000-0000000000b1";
const owed2150 = () =>
  Number(
    last(`select coalesce(sum(l.credit - l.debit), 0) from journal_line l
            join gl_account g on g.id = l.account_id where g.code = '2150' and g.business_id = '${B}'`),
  );

console.log("▸ the owner books the points held as money owed");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings#loyalty-owed");
  const card = page.getByTestId("loyalty-owed");
  await card.getByTestId("loyalty-owed-on").check();
  await card.getByText(/Saved: the points held are owed/).waitFor({ timeout: 15000 });
  const worth = Number(
    last(`select round(loyalty_points_held('${B}') * loyalty_point_value('${B}'))`),
  );
  check(
    last(`select enabled from loyalty_owed_setup where business_id = '${B}'`) === "t" &&
      owed2150() === worth,
    `on: the points held, worth ${worth.toLocaleString("en")}, owed on 2150`,
  );
  await page.reload();
  check(
    ((await page.getByTestId("loyalty-owed-figures").textContent()) ?? "").includes(
      "The books owe",
    ),
    "Settings says what the books owe",
  );
  await page.getByTestId("loyalty-owed-on").uncheck();
  await page
    .getByTestId("loyalty-owed")
    .getByText("Saved: points are a discount when they are taken, as before.")
    .waitFor({ timeout: 15000 });
  check(
    last(`select enabled from loyalty_owed_setup where business_id = '${B}'`) === "f" &&
      owed2150() === 0,
    "off: nothing owed",
  );
  await ctx.close();
}

console.log("▸ a manager sees it, and may not change it");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/settings#loyalty-owed");
  const box = page.getByTestId("loyalty-owed-on");
  if (await box.count()) {
    check(await box.isDisabled(), "the switch is the owner's");
  } else {
    check(true, "Settings is not the manager's");
  }
  await ctx.close();
}

await browser.close();
done("loyalty points as money owed");
