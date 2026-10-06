"use client";

import { fmtIQD, fmtQty } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import {
  DAY_PARTS,
  PART_LABEL,
  labourPercent,
  weekCheck,
  type DayPart,
  type PartCheck,
  type PlannedShift,
  type Staffing,
} from "@/lib/staffing";

/** The café's week, Saturday first: phrases, shown through t(). */
const DAY_NAME = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
/** A part of a named day, as said in a sentence: phrases, shown through t(). */
const PART_OF_DAY: Record<DayPart, string> = {
  morning: "{day} morning",
  afternoon: "{day} afternoon",
  evening: "{day} evening",
};
const MARK = { short: "▲", quiet: "▽", nobody: "●" } as const;

/** People at a time, to a tenth. */
const tenth = (n: number) => fmtQty(Math.round(n * 10) / 10);
/** The people a part's orders need: one at least, when it sells at all. */
const needOf = (c: PartCheck) => (c.needed === null ? null : Math.max(1, Math.round(c.needed)));
const pct = (n: number | null) => (n === null ? "—" : `${fmtQty(Math.round(n))}%`);

/**
 * Is the week staffed for how busy it usually is? (round ten) The week as
 * typed, part of the day by part, against the four weeks to yesterday: the
 * people scheduled at a time, the people its orders usually need, and where
 * that is too few, too many, or nobody. With pay seen, what the scheduled
 * hours cost against what a usual week sells, and the target (0071). It
 * changes as the hours are typed, before they are saved.
 */
export function ScheduleCheck({
  staffing,
  shifts,
  costs,
  target,
}: {
  staffing: Staffing;
  shifts: PlannedShift[];
  /** Each person's hour of pay, for those who see pay; null for those who do not. */
  costs: Record<string, number | null> | null;
  /** The labour target, a share of net sales (0071); 0 none, null unknown. */
  target: number | null;
}) {
  const { t } = useT();
  const check = weekCheck(staffing, shifts, costs ? (id) => costs[id] ?? null : undefined);
  const at = (day: number, part: DayPart) => check.find((c) => c.day === day && c.part === part);
  const named = (c: PartCheck) => t(PART_OF_DAY[c.part], { day: t(DAY_NAME[c.day] ?? "") });
  const short = check.filter((c) => c.flag === "short");
  const quiet = check.filter((c) => c.flag === "quiet");
  const nobody = check.filter((c) => c.flag === "nobody");
  const sum = (f: (c: PartCheck) => number, of: PartCheck[] = check) =>
    of.reduce((n, c) => n + f(c), 0);
  const cost = sum((c) => c.cost);
  const net = sum((c) => c.net);
  const unpriced = sum((c) => c.unpriced);

  if (staffing.usual === null)
    return (
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }} data-testid="schedule-check">
        {t(
          "Once the café has four weeks of sales with people clocked in, the week is checked here against how busy each part of the day usually is.",
        )}
      </p>
    );

  return (
    <section className="sched-check" data-testid="schedule-check" aria-labelledby="sched-check-h">
      <h3 id="sched-check-h" style={{ margin: 0 }}>
        {t("Is the week staffed for how busy it usually is?")}
      </h3>
      <p className="muted" style={{ margin: 0, fontSize: ".82rem" }}>
        {t(
          "From the four weeks to yesterday: what each part of the day usually brings on its weekday, and the {n} orders a person usually serves in an hour. Each cell: the people scheduled at a time, and about how many its orders need.",
          { n: tenth(staffing.usual) },
        )}
      </p>
      <div className="tw">
        <table className="check-table">
          <thead>
            <tr>
              <th />
              {DAY_NAME.map((d) => (
                <th key={d}>{t(d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAY_PARTS.map((part) => (
              <tr key={part} data-part={part}>
                <th scope="row">{t(PART_LABEL[part])}</th>
                {DAY_NAME.map((d, day) => {
                  const c = at(day, part);
                  const need = c ? needOf(c) : null;
                  return (
                    <td
                      key={d}
                      className={`check-cell ${c?.flag ?? (c && c.hours > 0 ? "fine" : "")}`}
                      data-testid="check-cell"
                      data-day={day}
                      data-part={part}
                      data-flag={c?.flag ?? ""}
                    >
                      {!c || c.hours === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        <>
                          <span aria-hidden="true">{c.flag ? MARK[c.flag] : "✓"} </span>
                          {need === null
                            ? tenth(c.people)
                            : t("{people} · needs {need}", { people: tenth(c.people), need })}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {costs && (
              <tr data-testid="check-labour">
                <th scope="row">{t("Labour")}</th>
                {DAY_NAME.map((d, day) => {
                  const of = check.filter((c) => c.day === day);
                  return (
                    <td key={d} className="mono" data-day={day}>
                      {pct(
                        labourPercent(
                          sum((c) => c.cost, of),
                          sum((c) => c.net, of),
                        ),
                      )}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ul className="check-says">
        {short.length > 0 && (
          <li className="warn" data-testid="check-short">
            <span aria-hidden="true">▲ </span>
            {t("Too few: {list}.", {
              list: short
                .map((c) =>
                  t("{part} ({people} scheduled, about {need} needed)", {
                    part: named(c),
                    people: tenth(c.people),
                    need: needOf(c) ?? 1,
                  }),
                )
                .join("; "),
            })}
          </li>
        )}
        {nobody.length > 0 && (
          <li className="err" data-testid="check-nobody">
            <span aria-hidden="true">● </span>
            {t("Nobody scheduled when orders usually come: {list}.", {
              list: nobody.map(named).join("; "),
            })}
          </li>
        )}
        {quiet.length > 0 && (
          <li className="info" data-testid="check-quiet">
            <span aria-hidden="true">▽ </span>
            {t("More than needed: {list}.", {
              list: quiet
                .map((c) =>
                  t("{part} ({people} scheduled, about {need} needed)", {
                    part: named(c),
                    people: tenth(c.people),
                    need: needOf(c) ?? 1,
                  }),
                )
                .join("; "),
            })}
          </li>
        )}
        {short.length + nobody.length + quiet.length === 0 && (
          <li className="ok" data-testid="check-fine">
            <span aria-hidden="true">✓ </span>
            {t("Every part of the week has about the people it usually needs.")}
          </li>
        )}
        {costs && (
          <li className="info" data-testid="check-cost">
            <span aria-hidden="true">● </span>
            {t(
              target && target > 0
                ? "The week's hours cost {cost}: {pct} of what a usual week sells, against a target of {target}."
                : "The week's hours cost {cost}: {pct} of what a usual week sells. No labour target is set (Settings → Rules).",
              {
                cost: fmtIQD(Math.round(cost)),
                pct: pct(labourPercent(cost, net)),
                target: pct(target),
              },
            )}{" "}
            {t("By part of the day: {list}.", {
              list: DAY_PARTS.map((part) => {
                const of = check.filter((c) => c.part === part);
                return `${t(PART_LABEL[part])} ${pct(
                  labourPercent(
                    sum((c) => c.cost, of),
                    sum((c) => c.net, of),
                  ),
                )}`;
              }).join(" · "),
            })}
            {unpriced > 0 &&
              ` ${t("{n} hour(s) of people whose pay is not set are not counted.", {
                n: fmtQty(Math.round(unpriced)),
              })}`}
          </li>
        )}
      </ul>
    </section>
  );
}
