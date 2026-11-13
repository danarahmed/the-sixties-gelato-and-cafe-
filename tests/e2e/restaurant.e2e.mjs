// The restaurant parts (0110), through the real screens: the owner turns on
// the kitchen screens and reservations; a counter sale goes to the kitchen's
// screen by itself, where it is marked ready, then done; a party waiting is
// added and seated. Turned off again after.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();

async function turn(page, part, reason) {
  const row = page.locator(`[data-testid="part-row"][data-part="${part}"]`);
  await page.getByTestId("parts-reason").fill(reason);
  await row.getByTestId("part-toggle").click();
  await page.waitForTimeout(1200);
}

console.log("▸ the owner turns the kitchen and the bookings on");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings#plan");
  await page.getByTestId("plan-and-parts").waitFor({ timeout: 10000 });
  await turn(page, "kitchen", "The kitchen has a screen now");
  await turn(page, "reservations", "We take bookings now");
  check(
    last(
      `select string_agg(part, ',' order by part) from business_part where enabled and part in ('kitchen', 'reservations')`,
    ) === "kitchen,reservations",
    "both on",
  );
  await ctx.close();
}

console.log("▸ a counter sale goes to the kitchen's screen");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  const tab = page.getByRole("tab", { name: "Menu", exact: true });
  if (await tab.count()) await tab.click();
  await page.getByRole("button", { name: "Dine-in" }).click();
  await page.locator(".product-tile", { hasText: "Golden espresso" }).first().click();
  await page.getByRole("button", { name: /Cash/ }).click();
  await page.locator(".pay-confirm").click();
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  await page.waitForTimeout(1500);
  check(
    Number(last(`select count(*) from kitchen_ticket where sales_order_id is not null`)) >= 1,
    "the sale's ticket is sent by itself",
  );
  await open(page, "/kitchen");
  const ticket = page.locator('[data-testid="kitchen-ticket"][data-status="new"]').first();
  await ticket.waitFor({ timeout: 15000 });
  check(
    ((await ticket.textContent()) ?? "").includes("Golden espresso"),
    "the kitchen sees what to make",
  );
  await ticket.getByTestId("ticket-ready").click();
  await page
    .locator('[data-testid="kitchen-ticket"][data-status="ready"]')
    .first()
    .waitFor({ timeout: 10000 });
  await page
    .locator('[data-testid="kitchen-ticket"][data-status="ready"]')
    .first()
    .getByTestId("ticket-done")
    .click();
  await page.waitForTimeout(1500);
  check(
    Number(last(`select count(*) from kitchen_ticket where status = 'done'`)) >= 1,
    "ready, then done",
  );

  console.log("▸ a party waiting, seated");
  await open(page, "/reservations");
  await page.getByTestId("booking-name").fill("E2E Lana");
  await page.getByTestId("booking-party").fill("3");
  await page.getByTestId("booking-wait").click();
  const row = page.locator('[data-testid="booking-row"][data-name="E2E Lana"]');
  await row.waitFor({ timeout: 10000 });
  await row.getByTestId("booking-seat").click();
  await page.waitForTimeout(1500);
  check(last(`select status from reservation where name = 'E2E Lana'`) === "seated", "seated");
  await ctx.close();
}

console.log("▸ turned off again");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings#plan");
  await page.getByTestId("plan-and-parts").waitFor({ timeout: 10000 });
  await turn(page, "kitchen", "Back as a café");
  await turn(page, "reservations", "Back as a café");
  await ctx.close();
}

await browser.close();
done("restaurant");
