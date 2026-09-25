// The system speaks (0029, the audit's P1-8), through the real screens: the
// dashboard opens on what needs someone — red first — and yesterday's brief,
// facts apart from calculations apart from what to do; a manager answers an
// alert with a note and it moves to "answered"; the owner snoozes one with a
// reason; a cleared condition leaves the dashboard by itself; the owner sets
// a threshold on Settings; and a manager says how many days a vendor takes to
// deliver.
import { chromium, check, done, open, signIn, sql } from "./lib.mjs";

const browser = await chromium.launch();
const bank = () =>
  Number(
    sql(`select coalesce(sum(l.debit - l.credit), 0) from journal_line l
          join journal_entry e on e.id = l.journal_entry_id join gl_account g on g.id = l.account_id
         where g.code = '1020' and e.status = 'published'
           and e.business_id = '00000000-0000-0000-0000-0000000000b1'`),
  );
/** A manual journal by the owner, as the Journals screen posts it. */
function journal(what, lines) {
  sql(`select test.act_as('owner@example.com');
       select save_journal(test.today(), '${what}', '${JSON.stringify(lines)}', true)`);
}

// The bank 50,000 below zero: rent recorded from it before the deposit.
if (bank() < 0)
  journal("E2E bank back to zero", [
    { code: "1020", debit: -bank() },
    { code: "3000", credit: -bank() },
  ]);
const out = bank() + 50000;
journal("E2E rent from the bank", [
  { code: "6000", debit: out },
  { code: "1020", credit: out },
]);

console.log("▸ the owner's dashboard: what needs someone first, then yesterday, then today");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/dashboard");
  const needs = page.getByTestId("needs-you");
  const bankAlert = needs
    .getByTestId("alert")
    .filter({ hasText: "Bank is -50,000 IQD: below zero" });
  check(
    (await needs.getByTestId("alert").first().getAttribute("data-urgency")) === "red" &&
      (await bankAlert.getAttribute("data-urgency")) === "red",
    "red comes first: the bank is 50,000 below zero",
  );
  const text = await bankAlert.textContent();
  check(
    text.includes("record where the money really came from") && text.includes("Sure"),
    "with why it matters, what to do, and how sure the rule is",
  );
  const brief = page.getByTestId("daily-brief");
  check((await brief.locator("h3").textContent()).startsWith("Yesterday, "), "yesterday's brief");
  check(
    (await brief.getByTestId("brief-facts").textContent()).includes("No sales.") &&
      (await brief.getByTestId("brief-calculations").textContent()).includes(
        "Nothing to calculate",
      ),
    "its facts and calculations apart: nothing sold yesterday in this scratch café",
  );
  check(
    (await brief.getByTestId("brief-to-do").textContent()).includes(
      "record where the money really came from",
    ),
    "and what to do: the red alert nobody has answered",
  );
  check(await page.getByText("Net sales today").isVisible(), "today's figures below");
  await ctx.close();
}

console.log("▸ a manager answers it with a note; the owner snoozes another");
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/dashboard");
  const red = page
    .getByTestId("needs-you")
    .locator('[data-urgency="red"]', { hasText: "Bank is -50,000 IQD" });
  await red.getByRole("button", { name: "Answer" }).click();
  await red.getByLabel("What was done, or why it is fine").fill("ok");
  check(
    await red.getByRole("button", { name: "Save the answer" }).isDisabled(),
    "an answer says something",
  );
  await red
    .getByLabel("What was done, or why it is fine")
    .fill("Rent went out before the deposit was entered");
  await red.getByRole("button", { name: "Save the answer" }).click();
  const answered = page.getByTestId("answered");
  await answered.waitFor({ timeout: 10000 });
  await answered.locator("summary").click();
  await answered
    .getByText("Answered by Demo Manager", { exact: false })
    .first()
    .waitFor({ timeout: 10000 });
  check(true, "it moves to answered, with who answered and how");
  check(
    sql(`select count(*) from audit_log where action = 'alert.acknowledge'
           and reason = 'Rent went out before the deposit was entered'`) === "1",
    "on the audit trail",
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/dashboard");
  // Twenty-odd ingredients with no cost yet fold into one row: opened, one is snoozed.
  const group = page.getByTestId("alert-group").first();
  check(
    /^🟠 No cost yet: \d+/.test((await group.locator("summary .alert-title").textContent()).trim()),
    "orange alerts of one rule fold into one row, with how many",
  );
  await group.locator("summary").click();
  const orange = group.locator('[data-urgency="orange"]').first();
  const title = (await orange.locator(".alert-title").textContent()).replace(/^🟠 /, "");
  await orange.getByRole("button", { name: "Snooze" }).click();
  await orange.getByLabel("Why it can wait").fill("the supplier's invoice comes next week");
  await orange.getByRole("button", { name: "Snooze it" }).click();
  await page
    .getByTestId("needs-you")
    .locator('[data-urgency="orange"]', { hasText: title })
    .waitFor({ state: "detached", timeout: 10000 });
  check(
    sql(`select count(*) from alert where title = $t$${title}$t$ and snoozed_until > now()
           and snooze_reason = 'the supplier''s invoice comes next week'`) === "1",
    "an orange alert snoozed for a week, with its reason, out of the list meanwhile",
  );
  await ctx.close();
}

console.log("▸ the money goes back in: the alert leaves by itself");
journal("E2E money into the bank from the owner", [
  { code: "1020", debit: 50000 },
  { code: "3000", credit: 50000 },
]);
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/dashboard");
  check(
    (await page.getByTestId("alert").filter({ hasText: "Bank is" }).count()) === 0,
    "no alert for the bank once it is back to zero",
  );
  check(
    sql(`select count(*) from alert where rule = 'cash_negative' and resolved_at is not null
           and ack_note = 'Rent went out before the deposit was entered'`) === "1",
    "resolved, and kept as it was, with its answer",
  );
  await ctx.close();
}

console.log("▸ the owner sets a threshold; a manager, a vendor's delivery time");
{
  const { ctx, page } = await signIn(browser, "owner");
  await open(page, "/settings");
  const form = page.getByTestId("alert-thresholds");
  await form.getByLabel("Margin target (%)").fill("96");
  await form.getByRole("button", { name: "Save thresholds" }).click();
  await form
    .getByText("Margin target (%): enter a number from 0 to 95")
    .waitFor({ timeout: 10000 });
  check(true, "within its limits");
  await form.getByLabel("Margin target (%)").fill("65");
  await form.getByRole("button", { name: "Save thresholds" }).click();
  await form
    .getByText("Saved, and on the audit trail.", { exact: false })
    .waitFor({ timeout: 10000 });
  check(
    sql(
      `select alert_settings::text from business where id = '00000000-0000-0000-0000-0000000000b1'`,
    ) === '{"margin_target_percent": 65}',
    "the margin target is 65% now",
  );
  await form.getByLabel("Margin target (%)").fill("");
  await form.getByRole("button", { name: "Save thresholds" }).click();
  await form
    .getByText("Saved, and on the audit trail.", { exact: false })
    .waitFor({ timeout: 10000 });
  check(
    sql(
      `select alert_settings::text from business where id = '00000000-0000-0000-0000-0000000000b1'`,
    ) === "{}",
    "emptied, it follows the default again",
  );
  await ctx.close();
}
{
  const { ctx, page } = await signIn(browser, "manager");
  await open(page, "/vendors");
  await page.locator("button.vrow", { hasText: "Sulaymaniyah Dairy Co." }).click();
  await page.getByRole("button", { name: "Edit vendor" }).click();
  const ev = page.getByTestId("edit-vendor");
  await ev.getByLabel("Days a delivery takes").fill("4");
  await ev.locator("label", { hasText: /^Why/ }).locator("input").fill("they deliver twice a week");
  await ev.getByRole("button", { name: "Save changes" }).click();
  await ev.getByText("Saved, and on the audit trail.").waitFor({ timeout: 10000 });
  check(
    sql(`select lead_time_days from supplier where name = 'Sulaymaniyah Dairy Co.'`) === "4",
    "the dairy takes 4 days to deliver: running out warns that much sooner",
  );
  await ctx.close();
}

await browser.close();
done("alerts");
