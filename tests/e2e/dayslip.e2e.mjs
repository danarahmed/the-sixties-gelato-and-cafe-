// The day's close on the receipt printer (round six), through the real
// screens: after a sale today, the owner prints the slip from End of Day. It
// is the café's slip, 72 mm wide, in the order the till's checks are: the day
// and who printed it; the day's net sales, as the page says them; the orders,
// voids and refunds and waste; how it was paid; the drawers; what sold the
// most; each step of the close, done or not; and lines to sign. In Arabic it
// prints right to left, in Arabic.
import { BASE, chromium, check, done, open, signIn, sql, TODAY } from "./lib.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";
const last = (q) => sql(q).split("\n").pop();
const VARIANT = "d1000000-0000-0000-0000-000000000001";

// A sale of its own, by card (no drawer needed), so the day has one whatever ran before.
sql(`select test.act_as('cashier@example.com');
     select record_sale(gen_random_uuid(), 'dine_in', 'card',
       '[{"variant_id": "${VARIANT}", "qty": 3}]'::jsonb)`);
// What sold the most today, as the database counts it: whatever else ran today, it is on the slip.
const product = last(`select p.name from sales_order o
                        join sales_order_line l on l.sales_order_id = o.id
                        join product_variant v on v.id = l.product_variant_id
                        join product p on p.id = v.product_id
                       where o.business_id = '${B}' and o.status not in ('voided', 'open')
                         and business_local_date('${B}', o.placed_at) = ${TODAY}
                       group by p.name order by sum(l.quantity) desc, sum(l.line_net) desc limit 1`);

/** The print dialog is not opened here, and the slip stays on the page to be read. */
async function printSlip(page) {
  await page.evaluate(() => {
    const st = window.setTimeout;
    window.setTimeout = (fn, ms, ...a) => (ms === 500 ? 0 : st(fn, ms, ...a));
    window.print = () => {};
  });
  await page.getByTestId("eod-slip").click();
  const paper = page.getByTestId("eod-slip-paper");
  await paper.waitFor({ state: "attached", timeout: 10000 });
  return paper;
}

console.log("▸ the owner prints the day's close on the receipt printer");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/end-of-day");
  const net = (await page.getByTestId("eod-net").textContent()) ?? "";
  const paper = await printSlip(page);
  const text = (await paper.textContent()) ?? "";
  check(
    text.includes("The day's close") && text.includes("Printed by") && text.includes("Demo Owner"),
    "the day's close, and who printed it",
  );
  check(
    ((await paper.getByTestId("eod-slip-total").textContent()) ?? "").includes(net) && net !== "",
    `its net sales, as the page says them: ${net}`,
  );
  const part = async (key) => (await paper.locator(`[data-part="${key}"]`).textContent()) ?? "";
  check(
    (await part("sales")).includes("Voids and refunds") && (await part("sales")).includes("Waste"),
    "the orders, voids and refunds, and waste",
  );
  check((await part("paid")).includes("Card"), "how it was paid: by card among them");
  check((await part("drawers")).includes("Counted today"), "the drawers");
  check((await part("top")).includes(product), `what sold the most: ${product} among it`);
  const checks = paper.locator(".sl-check");
  check(
    (await checks.count()) >= 3 && text.includes("Closed by") && text.includes("Checked by"),
    `each step of the close (${await checks.count()}), and lines to sign`,
  );
  // On paper, the slip alone: 72 mm of it.
  await page.emulateMedia({ media: "print" });
  const box = await paper.boundingBox();
  check(
    (await paper.isVisible()) &&
      !(await page.locator(".sidenav").first().isVisible()) &&
      box !== null &&
      Math.abs(box.width - (72 / 25.4) * 96) < 3,
    `printed alone, 72 mm wide (${box ? Math.round(box.width) : "?"} px)`,
  );
  await ctx.close();
}

console.log("▸ in Arabic, right to left");
{
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: "ar", url: BASE }]);
  await open(page, "/end-of-day");
  const paper = await printSlip(page);
  check(
    (await paper.getAttribute("dir")) === "rtl" &&
      ((await paper.textContent()) ?? "").includes("إغلاق اليوم"),
    "the slip prints right to left, in Arabic",
  );
  await ctx.close();
}

await browser.close();
done("dayslip");
