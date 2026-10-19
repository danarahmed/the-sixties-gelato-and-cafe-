// Two-step sign-in (round twenty-three, 0080), through the real screens: the
// owner turns it on from the Account page with an authenticator app's code;
// signing in again asks for the code before any page, a wrong one is
// refused, the right one lets them in; and it is turned off again.
import crypto from "node:crypto";
import { BASE, chromium, check, done, open, signIn, sql } from "./lib.mjs";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function unbase32(text) {
  let bits = "";
  for (const ch of text) bits += B32.indexOf(ch).toString(2).padStart(5, "0");
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
/** The six digits an authenticator app shows now (RFC 6238). */
function totp(secret) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = crypto.createHmac("sha1", unbase32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, "0");
}

const browser = await chromium.launch();
let secret = "";

console.log("▸ the owner turns it on");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/account");
  const card = page.getByTestId("two-step");
  await card.getByTestId("two-step-start").click();
  secret = (await card.getByTestId("two-step-secret").textContent()) ?? "";
  check(
    /^[A-Z2-7]{16,}$/.test(secret),
    "a key for the authenticator app, as a code to scan and as text",
  );
  await card.getByTestId("two-step-code").fill(totp(secret));
  await card.getByTestId("two-step-confirm").click();
  await card.getByTestId("two-step-on").waitFor({ timeout: 10000 });
  check(
    sql(`select count(*) from auth.mfa_factors where status = 'verified'`) === "1",
    "on: the second step is kept, confirmed",
  );
  await ctx.close();
}

console.log("▸ signing in asks for the code");
{
  // Signed in by hand: the password lands on the second step, not past /login.
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', "owner@example.com");
  await p.fill('input[name="password"]', "password123");
  await p.locator('button[type="submit"]').first().click();
  await p.waitForURL((u) => u.pathname === "/login/verify", { timeout: 15000 });
  check(true, "the password alone stops at the second step");
  await open(p, "/reports").catch(() => {});
  check(new URL(p.url()).pathname === "/login/verify", "no page opens before the code");
  await p.getByTestId("verify-code").fill("000000");
  await p.getByTestId("verify-submit").click();
  await p.getByRole("alert").waitFor({ timeout: 10000 });
  check(new URL(p.url()).pathname === "/login/verify", "a wrong code is refused");
  await p.getByTestId("verify-code").fill(totp(secret));
  await p.getByTestId("verify-submit").click();
  await p.waitForURL((u) => u.pathname !== "/login/verify", { timeout: 10000 });
  check(true, "the right code lets them in");
  await open(p, "/account");
  await p.getByTestId("two-step").getByTestId("two-step-off").click();
  await p.getByTestId("two-step").getByTestId("two-step-start").waitFor({ timeout: 10000 });
  check(sql(`select count(*) from auth.mfa_factors`) === "0", "turned off again");
  await ctx.close();
}

await browser.close();
done("twostep");
