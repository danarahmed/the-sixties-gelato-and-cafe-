// The till from a keyboard (round five), through the real till: a name typed
// anywhere on it finds the product and the one lit goes in with Enter; a
// number typed first adds that many, as does "2*" in the search; F4 takes a
// card and Enter records it; F2 opens cash at the exact amount (or asks for
// the drawer while none is open); Escape clears; "?" lists the keys; and a
// dialog open over the till keeps its keys to itself.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";
const last = (q) => sql(q).split("\n").pop();
const sales = () =>
  Number(
    last(`select count(*) from sales_order where business_id = '${B}' and status = 'completed'`),
  );
const drawerOpen = () =>
  Number(
    last(`select count(*) from work_shift where business_id = '${B}' and kind = 'session'
            and closed_at is null`),
  ) > 0;
/** Nothing focused: the keys are the till's, not a box's. */
const away = (page) => page.evaluate(() => (document.activeElement ?? document.body).blur?.());

console.log("▸ the cashier rings up a sale from the keyboard alone");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  await page.getByRole("button", { name: "Dine-in" }).click();
  const search = page.getByRole("searchbox");
  const before = sales();

  // Three first, then the name, typed anywhere on the till.
  await away(page);
  await page.keyboard.press("3");
  check(
    (await page.getByTestId("kb-times").textContent()) === "× 3",
    "a number typed first is how many of the next one: × 3",
  );
  await page.keyboard.type("golden esp");
  const lit = page.locator(".product-tile.kb-on");
  check(
    (await search.inputValue()) === "golden esp" &&
      (await lit.count()) === 1 &&
      (await lit.textContent()).includes("Golden espresso"),
    "the name typed goes to the search, and what Enter adds is lit",
  );
  await page.keyboard.press("Enter");
  check(
    (await search.inputValue()) === "" && (await page.getByTestId("kb-times").count()) === 0,
    "Enter adds it, and the search and the count are done with",
  );

  // A dialog open over the till keeps its keys: letters typed there are not a search.
  await page.keyboard.press("F4");
  const total = page.getByTestId("pay-total");
  await total.waitFor({ timeout: 10000 });
  await page.keyboard.type("abc");
  check(
    (await search.inputValue()) === "",
    "with the payment open, letters are not taken for a search",
  );
  const shown = Number((await total.textContent()).replace(/\D/g, ""));
  await page.keyboard.press("Enter");
  await page.getByText("Sale recorded").waitFor({ timeout: 10000 });
  const sold = last(
    `select (select string_agg(l.product_name || ' ' || trim_scale(l.quantity), ', ')
               from sales_order_line l where l.sales_order_id = o.id)
            || ' ' || (select string_agg(x.tender_type::text, ',') from sales_tender x where x.sales_order_id = o.id)
            || ' ' || trim_scale(o.net_amount)
       from sales_order o
      where o.id = (select id from sales_order where business_id = '${B}' order by placed_at desc limit 1)`,
  );
  check(
    // The line is named with its size: "Golden espresso — Single".
    sales() === before + 1 && new RegExp(`^Golden espresso( — [^,]+)? 3 card ${shown}$`).test(sold),
    `F4 takes a card and Enter records it, once: ${sold}`,
  );

  // "2*" in the search is two of what is found.
  await search.fill("2*golden esp");
  await search.press("Enter");
  await away(page);
  // F2: cash, at the exact amount, Enter away; or the drawer first, while none is open.
  await page.keyboard.press("F2");
  if (drawerOpen()) {
    const cash = page.locator("#cash-received");
    await cash.waitFor({ timeout: 10000 });
    check(
      (await cash.inputValue()) === "" &&
        (await cash.getAttribute("placeholder")) === (await total.textContent()),
      "F2 takes cash, at the exact amount, for two espressos",
    );
  } else {
    await page.getByText("Open the drawer first").waitFor({ timeout: 10000 });
    check(true, "F2 takes cash: with no drawer open, it asks for the drawer first");
  }
  await page.keyboard.press("Escape");
  await page.locator('[aria-modal="true"]').waitFor({ state: "detached", timeout: 10000 });

  // "?" lists the keys; Escape clears.
  await away(page);
  await page.keyboard.press("?");
  const help = page.getByTestId("kb-help");
  const listed = (await help.isVisible()) ? await help.textContent() : "";
  check(
    ["F2", "F4", "Enter", "Esc", "Take a card"].every((k) => listed.includes(k)),
    'and "?" lists the keys',
  );
  await page.keyboard.press("Escape");
  check((await help.count()) === 0, "Escape puts the list away");
  await ctx.close();
}

await browser.close();
done("keys");
