// Warnings on your phone (0072, round eleven), through the real screens: the
// owner turns them on for the café on Settings, which says this database
// cannot send (it has no timer); the branch manager turns them on on a phone
// on My account — the urgent ones only, then every one — and sends it a test;
// the cashier is offered nothing; the app's address refuses without the
// database's secret and, with it, takes the queue; the manager turns them off
// on the phone, and the owner for the café; and the screens speak Arabic and
// Kurdish. A browser here has no push service to reach, so the phone's
// subscription is made in the page, as a phone's browser would hand it over.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";
import { english } from "./english.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";
const last = (q) => sql(q).split("\n").pop();
const ENDPOINT = "https://push.example/e2e-manager-phone";

/** A phone's browser, as far as the app sees it: it allows notifications and hands over a subscription. */
const PHONE = `
  (() => {
    const sub = {
      endpoint: ${JSON.stringify(ENDPOINT)},
      toJSON() { return { endpoint: this.endpoint, keys: { p256dh: "${"B".repeat(87)}", auth: "${"a".repeat(22)}" } }; },
      unsubscribe: async () => { localStorage.removeItem("e2e-sub"); return true; },
    };
    const has = () => localStorage.getItem("e2e-sub") === "1";
    PushManager.prototype.subscribe = async function () { localStorage.setItem("e2e-sub", "1"); return sub; };
    PushManager.prototype.getSubscription = async function () { return has() ? sub : null; };
    Object.defineProperty(Notification, "permission", { get: () => "granted" });
    Notification.requestPermission = async () => "granted";
  })();
`;

async function phone(who, subscribed = false) {
  const s = await signIn(browser, who);
  // A phone that took warnings before: its browser still holds the subscription.
  if (subscribed)
    await s.page.evaluate(() => {
      localStorage.setItem("e2e-sub", "1");
    });
  await s.ctx.addInitScript(PHONE);
  return s;
}

console.log("▸ off: Settings offers to turn them on; My account says the owner has not");
{
  const { ctx, page } = await phone("manager");
  await open(page, "/account");
  check(
    (await page.getByTestId("phone-warnings-cafe-off").count()) === 1,
    "the manager is told the owner has not turned them on yet",
  );
  await ctx.close();
}

console.log("▸ the owner turns them on for the café");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings");
  await page.getByTestId("phone-warnings-turn-on").click();
  await page
    .locator('[data-testid="phone-warnings-setup"][data-on="yes"]')
    .waitFor({ timeout: 15000 });
  check(
    (await page.getByTestId("phone-warnings-cannot-send").count()) === 1,
    "on, and Settings says this database cannot send yet (no timer, no calls out)",
  );
  const kept =
    last(`select enabled || ' ' || (site_url like 'http%') || ' ' || length(vapid_public) || ' ' || length(vapid_private)
                       from push_config where business_id = '${B}'`);
  check(
    kept === "true true 87 43",
    `the app gave the database its address and the café's keys: ${kept}`,
  );
  await ctx.close();
}

console.log("▸ the branch manager turns them on on a phone");
{
  const { ctx, page } = await phone("manager");
  await open(page, "/account");
  const card = page.getByTestId("phone-warnings");
  await card.getByLabel(/Only the urgent/).check();
  await page.getByTestId("phone-warnings-on").click();
  await page.getByTestId("phone-warnings-is-on").waitFor({ timeout: 15000 });
  const saved = () =>
    last(`select d.urgent_only || ' ' || d.locale || ' ' || u.email from push_device d
            join app_user u on u.id = d.member_id where d.endpoint = '${ENDPOINT}'`);
  check(
    saved() === "true en manager@example.com",
    `the phone is the manager's, urgent ones only: ${saved()}`,
  );
  await card.getByLabel(/Only the urgent/).uncheck();
  await page.waitForFunction(
    () =>
      !document.querySelector('[data-testid="phone-warnings"] input[type="checkbox"]')?.disabled,
  );
  await page.waitForTimeout(500);
  check(saved() === "false en manager@example.com", "then every warning");
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByTestId("phone-warnings-is-on").waitFor({ timeout: 15000 });
  check(true, "opened again, My account knows this phone gets them");
  await page.getByTestId("phone-warnings-test").click();
  await page.getByText(/The test waits|A test is on its way/).waitFor({ timeout: 15000 });
  const queued = last(`select count(*) from push_message m join push_device d on d.id = m.device_id
                        where d.endpoint = '${ENDPOINT}' and m.tag = 'test'`);
  check(queued === "1", "a test waits for the phone");
  await ctx.close();
}

console.log("▸ the cashier is offered nothing");
{
  const { ctx, page } = await phone("cashier");
  await open(page, "/account");
  check(
    (await page.getByTestId("phone-warnings").count()) === 0,
    "no phone warnings for the cashier",
  );
  await ctx.close();
}

console.log("▸ the app's address: nothing without the secret; with it, the queue is taken");
{
  const post = (key) =>
    fetch(`${BASE}/api/push/send`, { method: "POST", headers: key ? { "x-push-key": key } : {} });
  const none = await post(null);
  const wrong = await post("x".repeat(64));
  check(
    none.status === 403 && wrong.status === 403,
    `refused without the secret (${none.status}, ${wrong.status})`,
  );
  const secret = last(`select secret from push_config where business_id = '${B}'`);
  const r = await post(secret);
  const body = await r.json();
  check(
    r.status === 200 && body.ok === true && body.sent + body.failed + body.gone >= 1,
    `with it, the queue is taken and tried (sent ${body.sent}, failed ${body.failed}, gone ${body.gone})`,
  );
  const taken = last(
    `select count(*) from push_message where taken_at is not null and tag = 'test'`,
  );
  check(taken === "1", "the test was taken from the queue");
}

console.log("▸ the screens in Arabic and in Kurdish");
for (const locale of ["ar", "ckb"]) {
  const { ctx, page } = await phone("manager");
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  await open(page, "/account");
  // A browser of its own: this phone is off here, its box checked and settled.
  await page
    .locator('[data-testid="phone-warnings"]:not([data-state="checking"])')
    .waitFor({ timeout: 15000 });
  const words = (await english(page, "/account")).filter((w) => !/^(PIN|IQD)$/.test(w));
  check(
    words.length === 0,
    `My account in ${locale}, no English but the café's own names` +
      (words.length ? `: ${words.slice(0, 12).join(" ")}` : ""),
  );
  await ctx.close();
}

console.log("▸ off on the phone, then for the café");
{
  const { ctx, page } = await phone("manager", true);
  await open(page, "/account");
  await page.getByTestId("phone-warnings-off").click();
  await page.getByTestId("phone-warnings-on").waitFor({ timeout: 15000 });
  check(
    last(`select count(*) from push_device where endpoint = '${ENDPOINT}'`) === "0",
    "turned off on the phone: it is no longer kept",
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings");
  await page.getByRole("button", { name: /Turn phone warnings off/ }).click();
  await page
    .locator('[data-testid="phone-warnings-setup"][data-on="no"]')
    .waitFor({ timeout: 15000 });
  check(
    last(`select enabled::text from push_config where business_id = '${B}'`) === "false",
    "the owner turns them off for the café",
  );
  await ctx.close();
}

await browser.close();
done("phonewarn");
