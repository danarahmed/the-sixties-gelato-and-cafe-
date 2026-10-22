/**
 * The watch list (0094, SMART_PLAN part 2): patterns a person may be hiding,
 * each set against what the others do at the same hours, as the database
 * finds them; read for the screen. Pure.
 */

export type WatchKind = "voids" | "discounts" | "drawer_short";
export type WatchStatus = "open" | "explained" | "looked_into";

export interface WatchFinding {
  id: string;
  person: string;
  kind: WatchKind;
  /** Discounts: the reason they were given with. */
  reason: string | null;
  firstSeen: string;
  lastSeen: string;
  /** The days it was judged over. */
  from: string;
  to: string;
  observed: number;
  expected: number;
  cases: number;
  /** The chance of so many by luck, from the others' rates. */
  chance: number;
  strength: "strong" | "worth_a_look";
  evidence: Record<string, unknown>;
  status: WatchStatus;
  settledAt: string | null;
  settledBy: string | null;
  note: string | null;
}

export interface WatchList {
  scannedAt: string | null;
  gmSees: boolean;
  findings: WatchFinding[];
}

const num = (v: unknown): number => (v === null || v === undefined || v === "" ? 0 : Number(v));
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);

export function watchListFrom(r: Record<string, unknown> | null | undefined): WatchList | null {
  if (!r || typeof r !== "object" || !Array.isArray(r.findings)) return null;
  return {
    scannedAt: strOrNull(r.scanned_at),
    gmSees: r.gm_sees === true,
    findings: (r.findings as Record<string, unknown>[]).map((f) => ({
      id: str(f.id),
      person: str(f.person),
      kind:
        f.kind === "discounts" ? "discounts" : f.kind === "drawer_short" ? "drawer_short" : "voids",
      reason: strOrNull(f.reason),
      firstSeen: str(f.first_seen),
      lastSeen: str(f.last_seen),
      from: str(f.from),
      to: str(f.to),
      observed: num(f.observed),
      expected: num(f.expected),
      cases: num(f.cases),
      chance: num(f.chance),
      strength: f.strength === "strong" ? "strong" : "worth_a_look",
      evidence: (f.evidence && typeof f.evidence === "object" ? f.evidence : {}) as Record<
        string,
        unknown
      >,
      status:
        f.status === "explained"
          ? "explained"
          : f.status === "looked_into"
            ? "looked_into"
            : "open",
      settledAt: strOrNull(f.settled_at),
      settledBy: strOrNull(f.settled_by),
      note: strOrNull(f.note),
    })),
  };
}

/** How many times the others' rate it is, to read: "46 times", or null when the others' rate gives nothing. */
export function timesAsOften(f: Pick<WatchFinding, "observed" | "expected">): number | null {
  if (!(f.expected > 0)) return null;
  const x = f.observed / f.expected;
  return x >= 10 ? Math.round(x) : Math.round(x * 10) / 10;
}

/** The chance by luck as a phrase's key: below one in a million, ten thousand, or as it is. */
export function chanceBand(chance: number): "million" | "hundred_thousand" | "ten_thousand" {
  return chance < 1e-6 ? "million" : chance < 1e-5 ? "hundred_thousand" : "ten_thousand";
}
