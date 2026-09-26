"use client";

import { Fragment, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { fmtQty } from "@/lib/format";
import { useT } from "@/lib/i18n/I18nProvider";
import type { Tender } from "./model";

/** The check: a bill handed over before payment, or the receipt after it. */
export interface PrintJob {
  /** A bill is handed over before payment; a receipt after it. */
  kind: "bill" | "receipt";
  title: string;
  channelLabel: string;
  lines: { name: string; qty: number; amount: number | null; note: string | null }[];
  /** Before the discount. */
  subtotal?: number;
  discount?: number;
  /** "10%" when the discount was a percentage. */
  discountLabel?: string | null;
  /** What is to be paid, or was paid. */
  total: number;
  tender?: Tender;
  received?: number | null;
  change?: number | null;
  reference?: string | null;
  /** A delivery platform's order number (0030). */
  platformOrderNo?: string | null;
  journalNo?: number | null;
  /** The second and later prints of a bill say so. */
  printCount?: number;
  /** The order's turn number (0034): the customer is called by it. */
  turnNo?: number | null;
  at: string;
  by: string;
}

export interface TicketItem {
  name: string;
  qty: number;
  note: string | null;
}

/** The barista's copy: the order's number and what to make, without the money. */
export interface BaristaTicket {
  kind: "ticket";
  turnNo: number | null;
  /** Quick sale, the table, or the customer's name. */
  title: string;
  channelLabel: string;
  platformOrderNo?: string | null;
  lines: TicketItem[];
  /** Taken off an order the bar already has: not to be made. */
  removed?: TicketItem[];
  /** More for an order the bar already has. */
  more?: boolean;
  /** Printed again: the bar has had this order already. */
  copy?: boolean;
  at: string;
  by: string;
}

/** What one press of print sends to the printer: one or more slips, each cut on its own. */
export type Slip = PrintJob | BaristaTicket;

/** The barista's copy of a check: the same order, without the money. */
export function ticketFor(job: PrintJob): BaristaTicket {
  return {
    kind: "ticket",
    turnNo: job.turnNo ?? null,
    title: job.title,
    channelLabel: job.channelLabel,
    platformOrderNo: job.platformOrderNo ?? null,
    lines: job.lines.map(({ name, qty, note }) => ({ name, qty, note })),
    at: job.at,
    by: job.by,
  };
}

const money = (n: number) => Math.round(n).toLocaleString("en-US");

/**
 * The slips for an 80 mm receipt printer (72 mm printable), or any printer
 * the till is connected to: everything else on the page is hidden while they
 * print. Each slip starts a page of its own, so a printer set to cut after
 * each page cuts the customer's check and the barista's ticket apart; one
 * that cuts once has a dashed line to tear along. The browser's print dialog
 * chooses the printer; a till set up for silent printing prints straight away
 * (see the cashier guide).
 */
export function PrintSlip({
  slips,
  businessName,
  timezone,
  onDone,
}: {
  slips: Slip[] | null;
  businessName: string;
  timezone: string;
  onDone: () => void;
}) {
  const { locale, dir } = useT();
  // Printed once per job, however often the till re-renders meanwhile.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!slips || slips.length === 0) return;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      done.current();
    };
    window.addEventListener("afterprint", finish);
    // Let the slips render before the print dialog takes its picture of the page.
    const timer = window.setTimeout(() => {
      window.print();
      window.setTimeout(finish, 500);
    }, 60);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", finish);
    };
  }, [slips]);

  if (!slips || slips.length === 0 || typeof document === "undefined") return null;
  const at = (iso: string, withDate: boolean) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      ...(withDate ? { day: "2-digit", month: "2-digit", year: "numeric" } : {}),
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  return createPortal(
    <div className="print-slip" dir={dir} lang={locale}>
      {slips.map((s, i) => (
        <Fragment key={i}>
          {i > 0 && <div className="sl-cut" aria-hidden />}
          {s.kind === "ticket" ? (
            <TicketSlip ticket={s} time={at(s.at, false)} />
          ) : (
            <CheckSlip job={s} businessName={businessName} when={at(s.at, true)} />
          )}
        </Fragment>
      ))}
    </div>,
    document.body,
  );
}

/** The café's mark: a scoop on a cone, in a double ring; on paper, and on the empty till. */
export function Emblem({ className = "sl-emblem" }: { className?: string }) {
  const clip = useId();
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="22.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="24" cy="24" r="19.6" fill="none" stroke="currentColor" strokeWidth="0.7" />
      <circle cx="24" cy="11.6" r="1.9" fill="currentColor" />
      <path d="M15.2 22.4a8.8 8.8 0 0 1 17.6 0z" fill="currentColor" />
      <clipPath id={clip}>
        <path d="M16.2 23.6h15.6L24 39.6z" />
      </clipPath>
      <path
        d="M16.2 23.6h15.6L24 39.6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <g clipPath={`url(#${clip})`} stroke="currentColor" strokeWidth="0.9">
        <path d="M12 24l16 16M17 23l16 16M22 22l16 16M36 24L20 40M31 23L15 39M26 22L10 38" />
      </g>
    </svg>
  );
}

/** A rule with a diamond at its middle, under the thanks. */
function Ornament() {
  return (
    <svg className="sl-orn" viewBox="0 0 120 8" aria-hidden="true">
      <path d="M4 4h46M70 4h46" stroke="#000" strokeWidth="1" />
      <path d="M60 0.5l3.5 3.5-3.5 3.5-3.5-3.5z" fill="#000" />
    </svg>
  );
}

/** The full check, for the customer and the cashier. */
function CheckSlip({
  job,
  businessName,
  when,
}: {
  job: PrintJob;
  businessName: string;
  when: string;
}) {
  const { t } = useT();
  const count = job.lines.reduce((n, l) => n + l.qty, 0);
  const discounted = job.discount != null && job.discount > 0;
  const reference = [
    job.reference ? `${t("print.sale")} ${job.reference}` : null,
    job.journalNo != null ? `${t("pos.journal")} ${job.journalNo}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <section className="slip">
      <header className="sl-head">
        <Emblem />
        <div className="sl-brand">{businessName}</div>
        <div className="sl-kind">
          <span>{job.kind === "bill" ? t("print.bill") : t("print.receipt")}</span>
        </div>
        {job.kind === "bill" && (job.printCount ?? 1) > 1 && (
          <div className="sl-copy">
            {t("print.copy")} {job.printCount}
          </div>
        )}
      </header>

      {job.turnNo != null && (
        <div className="sl-turn">
          <span className="sl-turn-label">{t("print.yourNumber")}</span>
          <span className="sl-turn-no">{job.turnNo}</span>
        </div>
      )}

      <div className="sl-meta">
        <div>
          <span>{t("print.order")}</span>
          <strong>{job.title}</strong>
        </div>
        <div>
          <span>{t("pos.channel")}</span>
          <strong>{job.channelLabel}</strong>
        </div>
        {job.platformOrderNo && (
          <div className="sl-wide">
            <strong>{t("print.orderNo").replace("{no}", job.platformOrderNo)}</strong>
          </div>
        )}
        <div>
          <span>{t("print.date")}</span>
          <strong>{when}</strong>
        </div>
        <div>
          <span>{t("print.cashier")}</span>
          <strong>{job.by}</strong>
        </div>
      </div>

      <table className="sl-items">
        <thead>
          <tr>
            <th className="q">{t("print.qty")}</th>
            <th>{t("print.item")}</th>
            <th className="a">{t("print.amount")}</th>
          </tr>
        </thead>
        <tbody>
          {job.lines.map((l, i) => (
            <tr key={i}>
              <td className="q">{fmtQty(l.qty)}</td>
              <td className="n">
                {l.name}
                {l.note && <span className="sl-note">{l.note}</span>}
              </td>
              <td className="a">{l.amount === null ? "—" : money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="sl-sums">
        <div className="sl-row sl-small">
          <span>
            {fmtQty(count)} {t("pos.items")}
          </span>
          {discounted && <span>{money(job.subtotal ?? job.total + (job.discount ?? 0))}</span>}
        </div>
        {discounted && (
          <div className="sl-row">
            <span>
              {t("pos.discount")}
              {job.discountLabel ? ` ${job.discountLabel}` : ""}
            </span>
            <span>−{money(job.discount ?? 0)}</span>
          </div>
        )}
        <div className="sl-total">
          <span>{t("pos.total")}</span>
          <span>
            {money(job.total)} <small>IQD</small>
          </span>
        </div>
        {job.kind === "receipt" && job.tender && (
          <>
            <div className="sl-row">
              <span>{t(`pos.tender.${job.tender}`)}</span>
              <span>{money(job.received ?? job.total)}</span>
            </div>
            {job.change != null && job.change > 0 && (
              <div className="sl-row sl-strong">
                <span>{t("pos.changeDue")}</span>
                <span>{money(job.change)}</span>
              </div>
            )}
          </>
        )}
      </div>

      <footer className="sl-foot">
        {job.kind === "receipt" ? (
          reference && <div>{reference}</div>
        ) : (
          <div className="sl-unpaid">{t("print.notPaid")}</div>
        )}
        <div className="sl-thanks">{t("print.thanks")}</div>
        <Ornament />
      </footer>
    </section>
  );
}

/** The barista's ticket: the number, who it is for, and what to make. */
function TicketSlip({ ticket, time }: { ticket: BaristaTicket; time: string }) {
  const { t } = useT();
  const count = ticket.lines.reduce((n, l) => n + l.qty, 0);
  const items = (lines: TicketItem[], off: boolean) => (
    <ul className={off ? "tk-items off" : "tk-items"}>
      {lines.map((l, i) => (
        <li key={i}>
          <span className="tk-q">{fmtQty(l.qty)}</span>
          <span className="tk-n">
            {l.name}
            {l.note && <span className="tk-note">{l.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <section className="slip slip-ticket">
      <div className="tk-bar">
        <span>{t("print.barista")}</span>
        <span>{time}</span>
      </div>
      {ticket.turnNo != null && (
        <div className="tk-no">
          <span className="tk-no-label">{t("print.no")}</span>
          <span className="tk-no-n">{ticket.turnNo}</span>
        </div>
      )}
      <div className="tk-who">{ticket.title}</div>
      <div className="tk-chan">
        <span>{ticket.channelLabel}</span>
        {ticket.platformOrderNo && (
          <span>{t("print.orderNo").replace("{no}", ticket.platformOrderNo)}</span>
        )}
      </div>
      {ticket.copy && <div className="tk-flag off">{t("print.ticketCopy")}</div>}
      {ticket.more && !ticket.copy && ticket.lines.length > 0 && (
        <div className="tk-flag">+ {t("print.added")}</div>
      )}
      {ticket.lines.length > 0 && items(ticket.lines, false)}
      {ticket.removed && ticket.removed.length > 0 && (
        <>
          <div className="tk-flag off">− {t("print.takenOff")}</div>
          {items(ticket.removed, true)}
        </>
      )}
      <div className="tk-foot">
        {count > 0 && (
          <>
            {fmtQty(count)} {t("pos.items")} ·{" "}
          </>
        )}
        {ticket.by}
      </div>
    </section>
  );
}
