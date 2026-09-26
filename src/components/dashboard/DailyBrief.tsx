import { briefCalculations, briefFacts, briefToDo, type DailyBrief as Brief } from "@/lib/alerts";
import type { Msg, T } from "@/lib/i18n/core";

/**
 * The owner's daily brief (0029, the audit's §6): yesterday's facts, the
 * calculations made from them, and what needs doing — kept apart, so a figure
 * is never mistaken for a judgement. The page gives it its reader's words: the
 * brief's lines are written in them (t), and what to do is the alerts' own
 * words from the database (msg).
 */
export function DailyBrief({
  brief,
  heading,
  labels,
  t,
  msg,
}: {
  brief: Brief;
  heading: string;
  labels: { facts: string; calculations: string; toDo: string };
  t: T;
  msg: Msg;
}) {
  const d = new Date(`${brief.day}T12:00:00Z`);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  // "24 Sept": the day as it is, the month's name in the reader's language.
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    .formatToParts(d)
    .map((p) => (p.type === "month" ? t(p.value) : p.value))
    .join("");
  return (
    <section className="card" data-testid="daily-brief">
      <h3 style={{ marginTop: 0 }}>
        {heading}, {t(weekday)} {date}
      </h3>
      <div className="brief">
        <div data-testid="brief-facts">
          <h4>{labels.facts}</h4>
          <ul>
            {briefFacts(brief, t).map((l) => (
              <li key={l}>{msg(l)}</li>
            ))}
          </ul>
        </div>
        <div data-testid="brief-calculations">
          <h4>{labels.calculations}</h4>
          <ul>
            {briefCalculations(brief, weekday, t).map((l) => (
              <li key={l}>{msg(l)}</li>
            ))}
          </ul>
        </div>
        <div data-testid="brief-to-do">
          <h4>{labels.toDo}</h4>
          <ul>
            {briefToDo(brief, t).map((l) => (
              <li key={l}>{msg(l)}</li>
            ))}
          </ul>
          {brief.red + brief.orange > 0 && (
            <p className="muted" style={{ fontSize: ".8rem", margin: "8px 0 0" }}>
              {t("Open now: 🔴 {red} · 🟠 {orange} — each above, with what to do.", {
                red: brief.red,
                orange: brief.orange,
              })}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
