/** "Something's wrong" (G5, 0083): what staff said went wrong, and where. */

export interface ProblemReport {
  id: string;
  page: string;
  what: string;
  context: Record<string, unknown>;
  status: "open" | "done";
  note: string | null;
  createdAt: string;
  by: string | null;
  place: string | null;
  settledBy: string | null;
  settledAt: string | null;
}

export interface ProblemList {
  open: number;
  reports: ProblemReport[];
}

const s = (v: unknown) => (v == null ? null : String(v));

export function problemList(d: unknown): ProblemList {
  const r = (d ?? {}) as Record<string, unknown>;
  const list = Array.isArray(r.reports) ? (r.reports as Record<string, unknown>[]) : [];
  return {
    open: Number(r.open ?? 0),
    reports: list.map((p) => ({
      id: String(p.id),
      page: String(p.page ?? "/"),
      what: String(p.what ?? ""),
      context:
        p.context && typeof p.context === "object" ? (p.context as Record<string, unknown>) : {},
      status: p.status === "done" ? "done" : "open",
      note: s(p.note),
      createdAt: String(p.created_at),
      by: s(p.by),
      place: s(p.place),
      settledBy: s(p.settled_by),
      settledAt: s(p.settled_at),
    })),
  };
}

/** One report as plain text, to send on (to whoever looks after the system). */
export function reportText(p: ProblemReport): string {
  const lines = [
    `Problem reported ${p.createdAt}${p.by ? ` by ${p.by}` : ""}${p.place ? ` at ${p.place}` : ""}`,
    `Screen: ${p.page}`,
    `What went wrong: ${p.what}`,
  ];
  for (const [k, v] of Object.entries(p.context)) lines.push(`${k}: ${String(v)}`);
  if (p.note) lines.push(`Note: ${p.note}`);
  return lines.join("\n");
}
