"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  closeSessionAction,
  forceCloseAction,
  handOverAction,
  openSessionAction,
} from "@/lib/actions/cash";
import {
  IQD_NOTES,
  closeSplit,
  notesCounted,
  notesTotal,
  type CountResult,
  type DrawerState,
  type SessionFigures,
} from "@/lib/cash";
import { fmtIQD } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { useT } from "@/lib/i18n/I18nProvider";
import { Notice } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";

type Mode = "view" | "open" | "close" | "handover" | "force";
type Done = { kind: Exclude<Mode, "view">; result: CountResult };
type Msg = { ok: boolean; text: string } | null;

/**
 * The drawer in sessions (0036): open it by counting what is in it, close it
 * by counting again, hand it to the next person, or — a manager — close one
 * left open. The count is blind: what the drawer should hold is shown only in
 * the answer, once the count is in (or, before, to those who may see it).
 */
export function DrawerPanel({ state, timezone }: { state: DrawerState; timezone: string }) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [busy, start] = useTransition();
  const [mode, setMode] = useState<Mode>("view");
  const [done, setDone] = useState<Done | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [count, setCount] = useState<CountValue>(EMPTY_COUNT);
  const [left, setLeft] = useState("");
  const [takeTo, setTakeTo] = useState<"safe" | "bank">("safe");
  const [floatFromSafe, setFloatFromSafe] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const s = state.session;
  const counted = countedOf(count);
  const split = closeSplit(counted.total ?? "", left);

  function begin(m: Mode) {
    setMode(m);
    setDone(null);
    setMsg(null);
    setCount(EMPTY_COUNT);
    setLeft("");
    setFloatFromSafe("");
    setTo(state.takers[0]?.id ?? "");
    setReason("");
  }

  function submit() {
    if (mode === "view") return;
    setMsg(null);
    const kind = mode;
    start(async () => {
      const total = counted.total ?? "";
      const notes = counted.notes;
      const r =
        kind === "open"
          ? await op.run("open", (key) =>
              openSessionAction({ counted: total, notes, floatFromSafe }, key),
            )
          : kind === "close"
            ? await op.run("close", (key) =>
                closeSessionAction(
                  {
                    counted: total,
                    notes,
                    left: left.trim() === "" ? null : left,
                    takeTo: split.taken && split.taken > 0 ? takeTo : null,
                    sessionId: s?.id ?? null,
                  },
                  key,
                ),
              )
            : kind === "handover"
              ? await op.run("handover", (key) =>
                  handOverAction(
                    {
                      counted: total,
                      notes,
                      left: left.trim() === "" ? null : left,
                      takeTo: split.taken && split.taken > 0 ? takeTo : null,
                      to,
                    },
                    key,
                  ),
                )
              : await op.run("force", (key) =>
                  forceCloseAction(
                    {
                      sessionId: s?.id ?? "",
                      reason,
                      counted: total === "" ? null : total,
                      notes,
                    },
                    key,
                  ),
                );
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setDone({ kind, result: r.data });
      setMode("view");
      router.refresh();
    });
  }

  const since = s ? dateTimeIn(timezone, s.openedAt) : null;
  const countForm = mode === "open" || mode === "close" || mode === "handover" || mode === "force";
  const counting = mode !== "force" || counted.total !== null;
  const ready =
    !busy &&
    counted.error === null &&
    (mode === "force"
      ? reason.trim() !== ""
      : counted.total !== null && (mode === "open" || split.error === null)) &&
    (mode !== "handover" || to !== "");

  return (
    <div className="grid" style={{ gap: 12 }} data-testid="drawer-panel">
      {done && <Answer done={done} />}

      {mode === "view" && (
        <div className="grid" style={{ gap: 8 }}>
          {s ? (
            <div data-testid="drawer-open">
              <strong>
                {t("The drawer is open: session {no}, {cashier}'s, since {when}", {
                  no: s.no,
                  cashier: s.cashier,
                  when: String(since),
                })}
              </strong>
              {state.seesExpected && state.expected !== null && (
                <Expected expected={state.expected} figures={state.figures} />
              )}
            </div>
          ) : (
            <div data-testid="drawer-closed">
              <strong>{t("The drawer is closed")}</strong>
              <div className="muted" style={{ fontSize: ".85rem" }}>
                {t("Cash is taken only while it is open: open it by counting the cash in it.")}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!s && state.mayOpen && (
              <button className="btn-primary" onClick={() => begin("open")}>
                {t("Open the drawer")}
              </button>
            )}
            {s && state.mayClose && (
              <button className="btn-primary" onClick={() => begin("close")}>
                {t("Close the drawer")}
              </button>
            )}
            {s && state.mayClose && state.takers.length > 0 && (
              <button onClick={() => begin("handover")}>{t("Hand over")}</button>
            )}
            {s && state.mayForce && !s.mine && (
              <button onClick={() => begin("force")}>{t("Close it for them")}</button>
            )}
          </div>
        </div>
      )}

      {countForm && (
        <div className="grid" style={{ gap: 10 }}>
          <strong>
            {mode === "open"
              ? t("Open the drawer")
              : mode === "close"
                ? t("Close session {no}", { no: s?.no ?? "" })
                : mode === "handover"
                  ? t("Hand session {no} over", { no: s?.no ?? "" })
                  : t("Close {cashier}'s session {no}", {
                      cashier: s?.cashier ?? "",
                      no: s?.no ?? "",
                    })}
          </strong>
          <span className="muted" style={{ fontSize: ".82rem" }}>
            {mode === "open"
              ? t(
                  "Count what is in the drawer now, before putting anything in. Its difference from what the last session left is shown once the count is in.",
                )
              : mode === "force"
                ? t(
                    "Say why. Count the drawer if you can; left empty, it closes without a count and the next opening count finds what it held.",
                  )
                : t(
                    "Count the cash in the drawer. What it should hold is shown once the count is in.",
                  )}
          </span>

          {mode === "force" && (
            <label>
              <div className="sc">{t("Why it is closed")}</div>
              <input
                aria-label={t("Why it is closed")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("The cashier went home without closing it")}
              />
            </label>
          )}

          <CountInput value={count} onChange={setCount} optional={mode === "force"} />

          {mode === "open" && state.mayAddFloat && (
            <label style={{ maxWidth: 260 }}>
              <div className="sc">{t("Cash put in from the safe now (optional)")}</div>
              <input
                aria-label={t("Cash from the safe")}
                className="amt"
                style={{ textAlign: "end" }}
                inputMode="decimal"
                value={floatFromSafe}
                onChange={(e) => setFloatFromSafe(e.target.value)}
                placeholder="0"
              />
            </label>
          )}

          {(mode === "close" || mode === "handover") && (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label style={{ minWidth: 170 }}>
                <div className="sc">
                  {mode === "handover"
                    ? t("Stays in the drawer for them")
                    : t("Stays in the drawer")}
                </div>
                <input
                  aria-label={t("Stays in the drawer")}
                  className="amt"
                  style={{ textAlign: "end" }}
                  inputMode="decimal"
                  value={left}
                  onChange={(e) => setLeft(e.target.value)}
                  placeholder={t("all of it")}
                />
              </label>
              {split.taken !== null && split.taken > 0 && (
                <label style={{ minWidth: 170 }}>
                  <div className="sc">
                    {t("The other {amount} goes to", { amount: fmtIQD(split.taken) })}
                  </div>
                  <select
                    aria-label={t("Takings go to")}
                    value={takeTo}
                    onChange={(e) => setTakeTo(e.target.value as "safe" | "bank")}
                  >
                    <option value="safe">{t("the safe (1005)")}</option>
                    <option value="bank">{t("the bank (1020)")}</option>
                  </select>
                </label>
              )}
              {mode === "handover" && (
                <label style={{ minWidth: 170 }}>
                  <div className="sc">{t("Hand the drawer to")}</div>
                  <select
                    aria-label={t("Hand the drawer to")}
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  >
                    {state.takers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          {(mode === "close" || mode === "handover") && split.error && (
            <p className="red" style={{ fontSize: ".85rem", margin: 0 }}>
              <SayError text={split.error} />
            </p>
          )}
          {(mode === "close" || mode === "handover") && state.openBills > 0 && (
            <p className="muted" style={{ fontSize: ".82rem", margin: 0 }}>
              {t(
                "{n} bill(s) are still open: they are no cash yet, and are paid in the next session.",
                {
                  n: state.openBills,
                },
              )}
            </p>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={submit} disabled={!ready}>
              {busy
                ? t("Saving…")
                : mode === "open"
                  ? t("Open the drawer")
                  : mode === "close"
                    ? t("Close the drawer")
                    : mode === "handover"
                      ? t("Hand over")
                      : counting
                        ? t("Close the session")
                        : t("Close it without a count")}
            </button>
            <button onClick={() => setMode("view")} disabled={busy}>
              {t("Back")}
            </button>
          </div>
        </div>
      )}

      <OperationStatus op={op} />
      <Notice msg={msg} />
    </div>
  );
}

/** What an open drawer should hold, for those who may see it. */
function Expected({ expected, figures }: { expected: number; figures: SessionFigures | null }) {
  const { t } = useT();
  return (
    <div className="muted" style={{ fontSize: ".85rem" }} data-testid="drawer-expected">
      {t("It should hold {amount}", { amount: fmtIQD(expected) })}
      {figures &&
        ` · ${t("cash sales {sales}, card {card}, {orders} order(s)", {
          sales: fmtIQD(figures.cashSales),
          card: fmtIQD(figures.card),
          orders: figures.orders,
        })}`}
    </div>
  );
}

/** The answer, once the count is in. */
function Answer({ done }: { done: Done }) {
  const { t } = useT();
  const r = done.result;
  const diff = (v: number | null) =>
    v === null
      ? null
      : v === 0
        ? t("it agrees exactly")
        : v < 0
          ? t("{amount} short", { amount: fmtIQD(-v) })
          : t("{amount} over", { amount: fmtIQD(v) });
  const journal = r.journalNo
    ? ` ${t("(6300 Cash over / short, journal {no})", { no: r.journalNo })}`
    : "";
  let head: string;
  if (done.kind === "open") {
    head = r.tookOver
      ? t(
          "Session {no} is open. The drawer counts before sessions end here: the books said the till held {expected}; counted {counted}: {difference}.",
          {
            no: r.sessionNo,
            expected: fmtIQD(r.expected ?? 0),
            counted: fmtIQD(r.counted ?? 0),
            difference: String(diff(r.variance)),
          },
        )
      : t(
          "Session {no} is open. Counted {counted}; the last session left {expected}: {difference}.",
          {
            no: r.sessionNo,
            counted: fmtIQD(r.counted ?? 0),
            expected: fmtIQD(r.expected ?? 0),
            difference: String(diff(r.variance)),
          },
        );
    if (r.floatFromSafe > 0)
      head += ` ${t("{amount} put in from the safe.", { amount: fmtIQD(r.floatFromSafe) })}`;
  } else if (r.counted === null) {
    head = t(
      "Session {no} is closed without a count: the {expected} it should hold stays in the drawer for the next opening count.",
      {
        no: r.sessionNo,
        expected: fmtIQD(r.expected ?? 0),
      },
    );
  } else {
    head = t(
      "Session {no} is closed. It should have held {expected}; counted {counted}: {difference}.",
      {
        no: r.sessionNo,
        expected: fmtIQD(r.expected ?? 0),
        counted: fmtIQD(r.counted),
        difference: String(diff(r.variance)),
      },
    );
    head +=
      r.taken > 0
        ? ` ${t("{taken} to the {place}; {left} stays in the drawer.", {
            taken: fmtIQD(r.taken),
            place: t(String(r.takenTo)),
            left: fmtIQD(r.left ?? 0),
          })}`
        : ` ${t("{left} stays in the drawer.", { left: fmtIQD(r.left ?? 0) })}`;
  }
  if (done.kind === "handover" && r.nextSessionNo) {
    head += ` ${t("Session {no} is open for {name}.", { no: r.nextSessionNo, name: String(r.nextCashier) })}`;
  }
  return (
    <div
      className={`badge ${r.variance === null || r.variance === 0 ? "ok" : "warn"}`}
      style={{ whiteSpace: "normal" }}
      data-testid="drawer-answer"
    >
      {head + journal}
      {r.figures && done.kind !== "open" && (
        <div style={{ fontSize: ".8rem", marginBlockStart: 4 }}>
          {t(
            "Cash sales {sales} · refunds {refunds} · voids {voids} · paid out {paidOut} · put in {cashIn} · taken out {cashOut} · card {card} · {orders} order(s)",
            {
              sales: fmtIQD(r.figures.cashSales),
              refunds: fmtIQD(r.figures.refunds),
              voids: fmtIQD(r.figures.voids),
              paidOut: fmtIQD(r.figures.paidOut),
              cashIn: fmtIQD(r.figures.cashIn),
              cashOut: fmtIQD(r.figures.cashOut),
              card: fmtIQD(r.figures.card),
              orders: r.figures.orders,
            },
          )}
        </div>
      )}
    </div>
  );
}

function SayError({ text }: { text: string }) {
  const { msg } = useT();
  return <>{msg(text)}</>;
}

/* ---------------------------------------------------------------- counting */

interface CountValue {
  byNotes: boolean;
  total: string;
  notes: Record<string, string>;
}
const EMPTY_COUNT: CountValue = { byNotes: false, total: "", notes: {} };

/** The count as the database takes it: a total, and the notes when counted by note. */
function countedOf(v: CountValue): {
  total: string | null;
  notes: Record<string, number> | null;
  error: string | null;
} {
  if (!v.byNotes)
    return { total: v.total.trim() === "" ? null : v.total, notes: null, error: null };
  const total = notesTotal(v.notes);
  if (total === null) return { total: null, notes: null, error: "Count whole notes." };
  const notes = notesCounted(v.notes);
  return { total: notes === null ? null : String(total), notes, error: null };
}

/**
 * The cash counted: a total typed, or the notes counted one kind at a time,
 * which make the total.
 */
function CountInput({
  value,
  onChange,
  optional,
}: {
  value: CountValue;
  onChange: (v: CountValue) => void;
  optional: boolean;
}) {
  const { t, msg } = useT();
  const c = countedOf(value);
  return (
    <div className="grid" style={{ gap: 8 }}>
      {value.byNotes ? (
        <div className="note-grid" data-testid="note-counter">
          {IQD_NOTES.map((n) => (
            <label key={n} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="mono" style={{ minWidth: 70, textAlign: "end" }}>
                {fmtIQD(n)} ×
              </span>
              <input
                aria-label={t("Notes of {note}", { note: fmtIQD(n) })}
                className="amt"
                style={{ width: 70, textAlign: "end" }}
                inputMode="numeric"
                value={value.notes[String(n)] ?? ""}
                onChange={(e) =>
                  onChange({ ...value, notes: { ...value.notes, [String(n)]: e.target.value } })
                }
                placeholder="0"
              />
            </label>
          ))}
          <div className="sc" style={{ marginBlockStart: 4 }}>
            {t("Counted")}:{" "}
            <strong className="mono">{c.total === null ? "—" : fmtIQD(Number(c.total))}</strong>
          </div>
          {c.error && (
            <span className="red" style={{ fontSize: ".8rem" }}>
              {msg(c.error)}
            </span>
          )}
        </div>
      ) : (
        <label style={{ maxWidth: 260 }}>
          <div className="sc">
            {optional ? t("Cash counted (IQD), if counted") : t("Cash counted (IQD)")}
          </div>
          <input
            aria-label={t("Cash counted")}
            className="amt"
            style={{ textAlign: "end" }}
            inputMode="decimal"
            value={value.total}
            onChange={(e) => onChange({ ...value, total: e.target.value })}
            placeholder="0"
          />
        </label>
      )}
      <button
        type="button"
        className="linklike"
        style={{ justifySelf: "start", fontSize: ".82rem" }}
        onClick={() => onChange({ ...value, byNotes: !value.byNotes })}
      >
        {value.byNotes ? t("Type the total instead") : t("Count note by note")}
      </button>
    </div>
  );
}
