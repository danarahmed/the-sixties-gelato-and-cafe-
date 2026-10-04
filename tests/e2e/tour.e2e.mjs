// Show me around (round six), through the real screens. A cashier new to the
// till is offered its tour in the empty order: each step lights a part of the
// till and says what it is for, the keyboard held in the tour (a letter typed
// does not reach the search); the arrows and Next go on, and Finish ends it,
// and the offer is not made again on this device. The menu takes the tour
// again whenever, and Escape ends it. On Production, "No thanks" puts the
// offer away for good. The dashboard's tour speaks Arabic, its arrows the way
// Arabic reads.
import { BASE, chromium, check, done, open, signIn } from "./lib.mjs";

const browser = await chromium.launch();
const tour = (page) => page.getByTestId("tour");
const step = async (page) => Number(await tour(page).getAttribute("data-step"));
const title = async (page) => (await tour(page).locator("#tour-title").textContent()) ?? "";

console.log("▸ a cashier new to the till is shown around it");
{
  const { ctx, page } = await signIn(browser, "cashier");
  await open(page, "/pos");
  // The menu, should the till open on its tables.
  const menuTab = page.getByRole("tab", { name: "Menu", exact: true });
  if (await menuTab.count()) await menuTab.click();
  const offer = page.getByTestId("tour-offer");
  check(
    (await offer.isVisible()) &&
      ((await offer.textContent()) ?? "").includes("New here? Let us show you around this screen."),
    "the empty order offers the till's tour",
  );
  await page.getByTestId("tour-start").click();
  await tour(page).waitFor();
  check(
    (await tour(page).getAttribute("data-tour")) === "pos" &&
      (await step(page)) === 1 &&
      (await title(page)) === "Find it fast" &&
      (await page.evaluate(() => document.activeElement?.dataset.testid)) === "tour-next",
    "step 1, the search, lit; the keyboard on Next",
  );
  // The search it points at is not typed into while the tour is open.
  await page.keyboard.press("a");
  check(
    (await page.locator('.pos-main input[type="search"]').inputValue()) === "",
    "a letter typed in the tour does not reach the till's search",
  );
  await page.keyboard.press("ArrowRight");
  check((await step(page)) === 2 && (await title(page)) === "Tap to add", "the arrow goes on");
  await page.keyboard.press("ArrowLeft");
  check((await step(page)) === 1, "and back");
  const total = Number(
    ((await tour(page).locator(".tour-count").textContent()) ?? "").match(/of (\d+)/)?.[1] ?? 0,
  );
  const titles = [await title(page)];
  for (let i = 1; i < total; i++) {
    await page.getByTestId("tour-next").click();
    titles.push(await title(page));
  }
  check(
    total >= 5 &&
      titles.includes("Take the money") &&
      titles.includes("Clock in and out") &&
      (await page.getByTestId("tour-next").textContent()) === "Finish",
    `every step in turn (${titles.join(" · ")}), the last one's button Finish`,
  );
  // Each step's part of the screen lit, inside the screen.
  const spot = await page.locator(".tour-spot").boundingBox();
  check(spot !== null && spot.width > 10 && spot.height > 10, "the part it is about, lit");
  await page.getByTestId("tour-next").click();
  check((await tour(page).count()) === 0, "Finish ends it");
  check((await offer.count()) === 0, "and the offer goes");
  await page.reload();
  await page.waitForLoadState("networkidle");
  check((await page.getByTestId("tour-offer").count()) === 0, "nor comes back on this device");

  console.log("▸ the menu takes it again, and Escape ends it");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByTestId("tour-menu").click();
  await tour(page).waitFor();
  check((await step(page)) === 1, "from the menu: the tour again, from its first step");
  await page.keyboard.press("Escape");
  check((await tour(page).count()) === 0, "Escape ends it");
  await ctx.close();
}

console.log("▸ on Production, No thanks puts the offer away");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/production");
  await page.getByTestId("tour-no").click();
  check((await page.getByTestId("tour-offer").count()) === 0, "No thanks: the offer goes");
  await page.reload();
  await page.waitForLoadState("networkidle");
  check((await page.getByTestId("tour-offer").count()) === 0, "and stays away on this device");
  await ctx.close();
}

console.log("▸ the dashboard's tour, in Arabic");
{
  const { ctx, page } = await signIn(browser, "owner");
  await ctx.addCookies([{ name: "locale", value: "ar", url: BASE }]);
  await open(page, "/dashboard");
  check(
    ((await page.getByTestId("tour-offer").textContent()) ?? "").includes(
      "جديد هنا؟ دعنا نعرّفك بهذه الشاشة.",
    ),
    "offered in Arabic",
  );
  await page.getByTestId("tour-start").click();
  await tour(page).waitFor();
  check(
    (await title(page)) === "اليوم في لمحة" &&
      ((await tour(page).locator(".tour-count").textContent()) ?? "").startsWith("الخطوة 1 من"),
    "its first step in Arabic",
  );
  // Arabic reads right to left: the left arrow goes on.
  await page.keyboard.press("ArrowLeft");
  check((await step(page)) === 2, "the left arrow goes on, the way Arabic reads");
  await ctx.close();
}

await browser.close();
done("tour");
