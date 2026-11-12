// The security fixes of plan 7 (0099), through the real screens: every page
// carries its script policy with a fresh nonce (and every suite fails on
// anything that policy refuses); the owner sets where the shop is by standing
// there; the till locks after the café's minutes and opens only to the PIN of
// the person signed in.
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const last = (q) => sql(q).split("\n").pop();
console.log("▸ every page carries its script policy, with a nonce of its own");
{
  const { ctx, page } = await signIn(browser, "manager");
  const policies = [];
  for (let i = 0; i < 2; i++) {
    const r = await page.goto(`${BASE}/pos`);
    policies.push(r?.headers()["content-security-policy"] ?? "");
  }
  const nonce = (p) => /'nonce-([^']+)'/.exec(p)?.[1] ?? null;
  check(
    policies.every((p) => /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/.test(p)),
    "the till's policy names a nonce",
  );
  check(nonce(policies[0]) !== nonce(policies[1]), "a new nonce every time the page is sent");
  check(
    policies.every((p) => p.includes("connect-src 'self'")),
    "the page talks to the app only",
  );
  check(!policies.some((p) => p.includes("unsafe-eval")), "and runs no text as code");
  // What a slipped-in script would look like (a handler in HTML): refused.
  page.expectsRefusal = true;
  const ran = await page.evaluate(
    () =>
      new Promise((resolve) => {
        window.__injected = false;
        document.body.insertAdjacentHTML(
          "beforeend",
          '<img src="/no-such-image.png" onerror="window.__injected = true" alt="">',
        );
        setTimeout(() => resolve(window.__injected), 800);
      }),
  );
  check(ran === false, "a script slipped into the page is refused");
  await ctx.close();
}

console.log("▸ the owner sets where the shop is, standing there");
{
  const { ctx, page } = await signIn(browser, "owner", {
    geolocation: { latitude: 36.19, longitude: 44.01, accuracy: 10 },
    permissions: ["geolocation"],
  });
  await open(page, "/settings#places");
  const spots = page.getByTestId("clock-spots");
  await spots.waitFor({ timeout: 10000 });
  const row = spots.getByTestId("clock-spot").first();
  await row.getByRole("button", { name: "Here" }).click();
  await row.getByText("36.19000, 44.01000").waitFor({ timeout: 10000 });
  check(true, "the place's spot is where the phone stood");
  check(
    last(
      `select count(*) from location where clock_lat between 36.1899 and 36.1901 and clock_radius_m = 150`,
    ) === "1",
    "kept, near is 150 m",
  );
  await row.getByRole("button", { name: "Take the spot away" }).click();
  await row.getByText("No spot: phones clock from anywhere").waitFor({ timeout: 10000 });
  check(
    last(`select count(*) from location where clock_lat is not null`) === "0",
    "and taken away again",
  );
  await ctx.close();
}

console.log("▸ the till locks after the café's minutes, and opens to its person's PIN");
sql(`select test.act_as('owner@example.com');
     select set_business_rule('till_lock_minutes', 'business', '', '1', 'Lock the till after a minute');
     select test.act_as('manager@example.com'); select set_my_pin('24680');`);
{
  const { ctx, page } = await signIn(browser, "manager");
  await page.clock.install();
  await open(page, "/pos");
  check((await page.getByTestId("till-lock").count()) === 0, "not locked while it is used");
  await page.clock.fastForward("01:10");
  const lock = page.getByTestId("till-lock");
  await lock.waitFor({ timeout: 10000 });
  check(true, "a minute with nobody touching it: locked");
  await lock.getByTestId("till-lock-pin").fill("1111");
  await lock.getByTestId("till-lock-go").click();
  await lock.getByText("That PIN is not right").waitFor({ timeout: 10000 });
  check(true, "a wrong PIN does not open it");
  await lock.getByTestId("till-lock-pin").fill("24680");
  await lock.getByTestId("till-lock-go").click();
  await lock.waitFor({ state: "detached", timeout: 10000 });
  check(true, "its person's PIN does");
  await ctx.close();
}
sql(`select test.act_as('owner@example.com');
     select set_business_rule('till_lock_minutes', 'business', '', '0', 'The till does not lock');`);

await browser.close();
done("security");
