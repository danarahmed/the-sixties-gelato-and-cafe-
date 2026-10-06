// Clocking in on your own phone, with the shop's code (0068, round eight),
// through the real screens. The owner makes the till a clock screen from the
// till itself; a manager links Rana's phone with the square on Staff, which
// the phone (not signed in) opens; the phone clocks Rana in with the code the
// till shows, and out with the 6 digits typed, a wrong code refused. At the
// till, Dara (no phone) clocks in with her PIN on the clock screen, and a till
// that is not one shows no clock. The phone's pages speak Kurdish and fit a
// phone. The phone is unlinked and the screen taken out of use, and the till
// clocks as before.
import { createHash } from "node:crypto";
import { BASE, chromium, check, done, open, signIn, sql, TODAY } from "./lib.mjs";

const browser = await chromium.launch();
const B = "00000000-0000-0000-0000-0000000000b1";
const last = (q) => sql(q).split("\n").pop();
const HERE_ID = last(`select default_location('${B}')`);
const HERE = last(`select name from location where id = '${HERE_ID}'`);
const sha = (s) => createHash("sha256").update(s).digest("hex");
/** The codes a clock screen's key is good for now: this half-minute's and the last. */
const codesNow = (screenId) =>
  last(`select string_agg(clock_code_of('${B}', '${screenId}', clock_window(clock_timestamp()) - w), ',')
          from generate_series(0, 1) w`).split(",");
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
/** A picture of the screen, when the run is asked for them (SHOTS: the folder). */
const shot = async (page, name) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
};

// Two people who work here: Rana will clock on her phone, Dara with her PIN.
sql(`select test.act_as('manager@example.com');
     select save_employee(null, 'Rana Phone', null, 'Barista', '${HERE_ID}', ${TODAY} - 10, null, gen_random_uuid())
      where not exists (select 1 from employee where full_name = 'Rana Phone');
     select save_employee(null, 'Dara Pin', null, 'Barista', '${HERE_ID}', ${TODAY} - 10, null, gen_random_uuid())
      where not exists (select 1 from employee where full_name = 'Dara Pin');
     select set_clock_pin((select id from employee where full_name = 'Dara Pin'), '7391');
     select set_clock_pin((select id from employee where full_name = 'Rana Phone'), '4826');`);
const RANA = last(`select id from employee where full_name = 'Rana Phone'`);
const DARA = last(`select id from employee where full_name = 'Dara Pin'`);
const closedOnPhone = () =>
  Number(
    last(`select count(*) from attendance where employee_id = '${RANA}' and clock_out is not null
            and source = 'phone'`),
  );
const CLOSED_BEFORE = closedOnPhone();
const linkedOnTrail = () =>
  Number(
    last(
      `select count(*) from audit_log where action = 'staff.phone_linked' and entity_id = '${RANA}'`,
    ),
  );
const LINKED_BEFORE = linkedOnTrail();

console.log("▸ before a clock screen, nothing changes");
const cashier = await signIn(browser, "cashier");
{
  await open(cashier.page, "/pos");
  check((await cashier.page.getByTestId("clock-button").count()) === 1, "the till has its clock");
  const owner = await signIn(browser, "owner");
  await open(owner.page, "/staff");
  check(
    (await owner.page.getByTestId("shop-clock-none").count()) === 1,
    "Staff's shop clock says there is none yet: everyone clocks in at the till with their PIN",
  );
  await owner.ctx.close();
}

console.log("▸ the owner makes the till the shop's clock screen, from the till");
// The till: the owner signs in on it to make it a clock screen; the cashier works on it after.
const till = await signIn(browser, "owner");
let SCREEN = "";
{
  const { ctx, page } = till;
  await open(page, "/staff");
  await page.getByTestId("clock-screen-make").click();
  check(
    (await page.getByTestId("clock-screen-name").inputValue()) === "The till",
    "its name is offered: The till",
  );
  await page.getByTestId("clock-screen-save").click();
  await page
    .getByText("This device is the clock screen “The till” now.")
    .waitFor({ timeout: 10000 });
  await page.getByTestId("clock-screen-this").waitFor({ timeout: 10000 });
  check(
    (await page.locator('[data-testid="clock-screen"][data-name="The till"]').count()) === 1,
    "the list shows The till, marked as this device",
  );
  const cookie = (await ctx.cookies()).find((c) => c.name === "clock_screen");
  check(
    Boolean(cookie) && cookie.httpOnly && /^[0-9a-f]{48}$/.test(cookie.value),
    "the till keeps its key in a cookie no script can read",
  );
  SCREEN = last(`select id from clock_screen where name = 'The till' and removed_at is null`);
  check(
    last(`select key_hash from clock_screen where id = '${SCREEN}'`) === sha(cookie?.value ?? ""),
    "the database keeps only the key's hash",
  );
  check(
    last(`select location_id from clock_screen where id = '${SCREEN}'`) === HERE_ID,
    "at the café's branch",
  );

  await open(page, "/clock/screen");
  const digits = page.getByTestId("shop-code-digits");
  await digits.waitFor({ timeout: 10000 });
  const shown = await digits.getAttribute("data-code");
  check(/^[0-9]{6}$/.test(shown ?? ""), "the whole-screen code: 6 digits");
  check(codesNow(SCREEN).includes(shown), "the code the database gives for this screen now");
  const qr = await page.getByTestId("shop-code-qr").getAttribute("data-text");
  check(qr === `${BASE}/clock?c=${shown}`, "its square opens the phone's clock with the code");
  check(
    (await page.getByText(/A new code in \d+ s/).count()) === 1,
    "and says when a new code comes",
  );
  await shot(page, "screen");
  check(
    (await page.locator(".menu-toggle").count()) === 0 &&
      (await page.locator(".account-badge").count()) === 0,
    "a tablet by the door: no menu, nothing of who is signed in",
  );
  check(
    (await page.getByTestId("clock-screen-sign-out").count()) === 1,
    "whoever is signed in is offered to sign out and keep the code",
  );

  // A tablet signed in as the owner, made the clock screen: signed out there,
  // it goes on showing the code, and the owner is still signed in elsewhere.
  const tablet = await signIn(browser, "owner");
  await tablet.ctx.addCookies([cookie]);
  await open(tablet.page, "/clock/screen");
  await tablet.page.getByTestId("clock-screen-sign-out").click();
  await tablet.page
    .getByTestId("clock-screen-sign-out")
    .waitFor({ state: "detached", timeout: 10000 })
    .catch(() => {});
  await tablet.page.getByTestId("shop-code-digits").waitFor({ timeout: 10000 });
  check(
    (await tablet.page.getByTestId("clock-screen-sign-out").count()) === 0 &&
      new URL(tablet.page.url()).pathname === "/clock/screen",
    "signed out there, the tablet still shows the code",
  );
  await tablet.page.goto(`${BASE}/dashboard`);
  check(
    new URL(tablet.page.url()).pathname === "/login",
    "and the tablet opens nothing of the café's without signing in",
  );
  await tablet.ctx.close();
  await open(page, "/staff");
  check(
    (await page.getByTestId("shop-clock").count()) === 1,
    "the owner's own session goes on, signed in",
  );
}

console.log("▸ a till that is not a clock screen shows no clock");
{
  await open(cashier.page, "/pos");
  check(
    (await cashier.page.getByTestId("clock-button").count()) === 0,
    "the cashier's other till has no clock now",
  );
}

console.log("▸ a manager links Rana's phone; the phone opens the square, not signed in");
const manager = await signIn(browser, "manager");
const phone = await browser.newContext(PHONE);
const phonePage = await phone.newPage();
phonePage.on("pageerror", (e) => check(false, `phone: browser error: ${e.message}`));
{
  const { page } = manager;
  await open(page, "/staff");
  const row = page.locator('[data-testid="person-row"][data-name="Rana Phone"]');
  await row.getByTestId("link-phone").click();
  const panel = page.getByTestId("phone-panel");
  await panel.getByTestId("phone-link-qr").waitFor({ timeout: 10000 });
  const url = await panel.getByTestId("phone-link-url").inputValue();
  check(/\/clock\/link\?k=[0-9a-f]{48}$/.test(url), "a square to scan, and its link");
  check(
    (await panel.getByTestId("phone-link-qr").getAttribute("data-text")) === url,
    "the square is the link",
  );
  check(
    (await panel.getByText("Waiting for the phone…").count()) === 1,
    "the panel waits for the phone",
  );

  await phonePage.goto(url);
  await phonePage.getByTestId("link-phone-go").click();
  await phonePage.getByTestId("link-phone-done").waitFor({ timeout: 10000 });
  check(
    (await phonePage.getByText("This phone clocks in Rana Phone now.").count()) === 1,
    "the phone is Rana's now",
  );
  const kept = (await phone.cookies()).find((c) => c.name === "clock_phone");
  check(Boolean(kept) && kept.httpOnly, "and keeps its own key, out of reach of scripts");
  check(
    last(`select key_hash from staff_phone where employee_id = '${RANA}' and ended_at is null`) ===
      sha(kept?.value ?? ""),
    "the database keeps only its hash",
  );

  await panel.getByTestId("phone-panel-linked").waitFor({ timeout: 10000 });
  check(
    (await panel.getByText("Linked: Rana Phone's phone clocks them in and out now.").count()) === 1,
    "the manager's panel says so by itself",
  );
  await page.getByText("Done", { exact: true }).click();
  await row.getByTestId("person-phone").waitFor({ timeout: 10000 });
  check(true, "Rana's row says her phone is linked");
  check(linkedOnTrail() === LINKED_BEFORE + 1, "on the audit trail");
  // Opened again, the link is spent.
  const again = await browser.newContext(PHONE);
  const againPage = await again.newPage();
  await againPage.goto(url);
  await againPage.getByTestId("link-phone-go").click();
  await againPage.getByTestId("link-phone-error").waitFor({ timeout: 10000 });
  check(
    (await againPage
      .getByText("This link was used already: ask a manager for a new one")
      .count()) === 1,
    "a link works once",
  );
  await again.close();
}

console.log("▸ Rana clocks in on her phone with the code the till shows");
{
  const code = await till.page.getByTestId("shop-code-digits").getAttribute("data-code");
  await open(phonePage, `/clock?c=${code}`);
  await phonePage.getByTestId("phone-clock").waitFor({ timeout: 10000 });
  check(
    (await phonePage.getByTestId("phone-clock-state").innerText()).includes("Not clocked in"),
    "the phone knows whose it is, and that she is not in",
  );
  const go = phonePage.getByTestId("phone-clock-go");
  check((await go.getAttribute("data-direction")) === "in", "one button: Clock in");
  check(
    await phonePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    "the page fits the phone",
  );
  await go.click();
  await phonePage.getByTestId("phone-clock-done").waitFor({ timeout: 10000 });
  check(
    /Rana Phone is clocked in, at \d\d:\d\d\./.test(
      await phonePage.getByTestId("phone-clock-done").innerText(),
    ),
    "Rana is clocked in, and told when",
  );
  await phonePage.waitForURL((u) => u.pathname === "/clock" && !u.search.includes("c="));
  check(true, "the address forgets the spent code");
  check(
    (await phonePage.getByTestId("phone-clock-next").innerText()) ===
      "When you leave, scan the shop's code again to clock out." &&
      (await phonePage.getByTestId("phone-clock-go").count()) === 0,
    "nothing more to press: when she leaves, she scans the code again",
  );
  await phonePage.getByText(`at ${HERE}`, { exact: false }).first().waitFor({ timeout: 10000 });
  check(
    (await phonePage.getByTestId("phone-clock-state").innerText()).startsWith("In since"),
    "the phone shows she is in, since when, and where",
  );
  check(
    last(`select source || ' ' || (screen_id = '${SCREEN}')::text || ' ' || (location_id = '${HERE_ID}')::text
            from attendance where employee_id = '${RANA}' and clock_out is null`) ===
      "phone true true",
    "her hours: clocked on her phone, with the till's code, at its place",
  );
  await shot(phonePage, "phone-in");
}

console.log("▸ out, with the 6 digits typed; a wrong code refused");
{
  await open(phonePage, "/clock");
  const go = phonePage.getByTestId("phone-clock-go");
  check((await go.getAttribute("data-direction")) === "out", "now the button is Clock out");
  check(await go.isDisabled(), "and waits for the code");
  await phonePage.getByTestId("phone-clock-code").fill("000 000");
  await go.click();
  await phonePage.getByTestId("phone-clock-error").waitFor({ timeout: 10000 });
  check(
    (await phonePage.getByTestId("phone-clock-error").innerText()) ===
      "That code has changed: scan the shop's code again",
    "a wrong code is refused, in words",
  );
  check(
    last(
      `select wrong_codes from staff_phone where employee_id = '${RANA}' and ended_at is null`,
    ) === "1",
    "and counted against the phone",
  );
  const code = await till.page.getByTestId("shop-code-digits").getAttribute("data-code");
  // Typed in Arabic digits, as a phone's keyboard may give them.
  const arabic = code.replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
  await phonePage.getByTestId("phone-clock-code").fill(arabic);
  await go.click();
  await phonePage.getByTestId("phone-clock-done").waitFor({ timeout: 10000 });
  check(
    /Rana Phone is clocked out, at \d\d:\d\d: 0 h today\./.test(
      await phonePage.getByTestId("phone-clock-done").innerText(),
    ),
    "Rana is clocked out with the digits typed, in Arabic digits too",
  );
  check(closedOnPhone() === CLOSED_BEFORE + 1, "her hours are closed");
}

console.log("▸ at the till that is the clock screen: the code, and Dara's PIN");
{
  // The cashier signs in on the till the owner made a clock screen: its key stays on it.
  const key = (await till.ctx.cookies()).find((c) => c.name === "clock_screen");
  const onTill = await signIn(browser, "cashier");
  await onTill.ctx.addCookies([
    { name: "clock_screen", value: key.value, url: BASE, httpOnly: true },
  ]);
  const { page } = onTill;
  await open(page, "/pos");
  await page.getByTestId("clock-button").click();
  const dialog = page.getByTestId("clock-dialog");
  await dialog.getByTestId("shop-code-digits").waitFor({ timeout: 10000 });
  check(
    codesNow(SCREEN).includes(
      await dialog.getByTestId("shop-code-digits").getAttribute("data-code"),
    ),
    "the till's clock shows the shop's code to scan",
  );
  check(
    (await dialog.getByText("No phone? Choose your name and type your PIN.").count()) === 1,
    "and, for those without a phone, the names",
  );
  const rana = dialog.locator('[data-testid="clock-person"][data-name="Rana Phone"]');
  await rana.waitFor({ timeout: 10000 });
  check(
    (await rana.isDisabled()) && (await rana.innerText()).includes("Clocks on their phone"),
    "Rana clocks on her phone: no PIN offered for her",
  );
  await dialog.locator('[data-testid="clock-person"][data-name="Dara Pin"]').click();
  await dialog.getByTestId("clock-pin").fill("7391");
  await dialog.getByTestId("clock-confirm").click();
  await dialog.getByTestId("clock-done").waitFor({ timeout: 10000 });
  check(
    (await dialog.getByTestId("clock-done").innerText()).startsWith("Dara Pin is clocked in"),
    "Dara clocks in with her PIN on the clock screen",
  );
  check(
    last(`select source || ' ' || (screen_id = '${SCREEN}')::text from attendance
           where employee_id = '${DARA}' and clock_out is null`) === "till true",
    "her hours say the till's clock screen",
  );
  await dialog.locator('[data-testid="clock-person"][data-name="Dara Pin"]').click();
  await dialog.getByTestId("clock-pin").fill("7391");
  await dialog.getByTestId("clock-confirm").click();
  await dialog.getByText(/Dara Pin is clocked out/).waitFor({ timeout: 10000 });
  check(true, "and out");
  await shot(page, "till");
  await onTill.ctx.close();
}

console.log("▸ a phone nobody linked, and the phone in Kurdish");
{
  const stranger = await browser.newContext(PHONE);
  const page = await stranger.newPage();
  await open(page, "/clock?c=123456");
  await page.getByTestId("phone-unlinked").waitFor({ timeout: 10000 });
  check(
    (await page.getByText("This phone is not linked yet").count()) === 1,
    "a phone nobody linked clocks no one, and says how to link it",
  );
  await stranger.close();

  await phone.addCookies([{ name: "locale", value: "ckb", url: BASE }]);
  await open(phonePage, "/clock");
  check(
    (await phonePage.getByTestId("phone-clock-go").innerText()).includes("تۆمارکردنی هاتن"),
    "in Kurdish, the button says Clock in",
  );
  check(
    (await phonePage.getByText("کۆدەکەی سەر شاشەی هاتن و ڕۆیشتنی دوکان").count()) >= 1,
    "and how to scan the shop's code",
  );
  await shot(phonePage, "phone-ckb");
  await phone.addCookies([{ name: "locale", value: "en", url: BASE }]);
}

console.log("▸ the phone unlinked, the screen taken out of use, the till as before");
{
  const { page } = manager;
  await open(page, "/staff");
  const row = page.locator('[data-testid="person-row"][data-name="Rana Phone"]');
  await row.getByTestId("link-phone").click();
  const panel = page.getByTestId("phone-panel");
  await panel.getByTestId("phone-unlink").click();
  await panel.getByTestId("phone-unlink-reason").fill("She lost it");
  await panel.getByTestId("phone-unlink-confirm").click();
  await page.waitForFunction(
    () =>
      !document.querySelector(
        '[data-testid="person-row"][data-name="Rana Phone"] [data-testid="person-phone"]',
      ),
    null,
    { timeout: 10000 },
  );
  check(true, "Rana's phone is unlinked");
  check(
    last(
      `select reason from audit_log where action = 'staff.phone_unlinked' and entity_id = '${RANA}'`,
    ) === "She lost it",
    "with why, on the audit trail",
  );
  await open(phonePage, "/clock");
  await phonePage.getByTestId("phone-unlinked").waitFor({ timeout: 10000 });
  check(true, "the lost phone clocks no one now");

  const { ctx, page: tp } = till;
  await open(tp, "/staff");
  await tp.getByTestId("clock-screen-remove").click();
  await tp.getByTestId("clock-screen-reason").fill("Moving the till");
  await tp.getByTestId("clock-screen-remove-confirm").click();
  await tp.getByTestId("shop-clock-none").waitFor({ timeout: 10000 });
  check(true, "the till is taken out of use: no clock screen left");
  check(
    !(await ctx.cookies()).some((c) => c.name === "clock_screen"),
    "and the till forgets its key",
  );
  await open(tp, "/clock/screen");
  await tp.getByTestId("shop-code-error").waitFor({ timeout: 10000 });
  check(
    (await tp.getByTestId("shop-code-error").innerText()) ===
      "This device is not one of the shop's clock screens",
    "it shows no code",
  );
  await open(cashier.page, "/pos");
  check(
    (await cashier.page.getByTestId("clock-button").count()) === 1,
    "with no clock screen, every till has its clock again",
  );
  check(
    last(`select count(*) from clock_screen where removed_at is null`) === "0" &&
      last(`select count(*) from staff_phone where ended_at is null`) === "0",
    "nothing is left in use for the suites after this one",
  );
}

await browser.close();
done("Clocking in on your own phone");
