import { briefCalculations, briefFacts, briefToDo, type DailyBrief as Brief } from "@/lib/alerts";

/**
 * The owner's daily brief (0029, the audit's §6): yesterday's facts, the
 * calculations made from them, and what needs doing — kept apart, so a figure
 * is never mistaken for a judgement.
 */
export function DailyBrief({
  brief,
  heading,
  labels,
}: {
  brief: Brief;
  heading: string;
  labels: { facts: string; calculations: string; toDo: string };
}) {
  const d = new Date(`${brief.day}T12:00:00Z`);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <section className="card" data-testid="daily-brief">
      <h3 style={{ marginTop: 0 }}>
        {heading}, {weekday} {date}
      </h3>
      <div className="brief">
        <div data-testid="brief-facts">
          <h4>{labels.facts}</h4>
          <ul>
            {briefFacts(brief).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
        <div data-testid="brief-calculations">
          <h4>{labels.calculations}</h4>
          <ul>
            {briefCalculations(brief, weekday).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
        <div data-testid="brief-to-do">
          <h4>{labels.toDo}</h4>
          <ul>
            {briefToDo(brief).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {brief.red + brief.orange > 0 && (
            <p className="muted" style={{ fontSize: ".8rem", margin: "8px 0 0" }}>
              Open now: 🔴 {brief.red} · 🟠 {brief.orange} — each above, with what to do.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
