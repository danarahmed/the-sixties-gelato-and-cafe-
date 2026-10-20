"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { readScan } from "@/lib/barcode";
import { fmtWeight } from "@/lib/weight";
import { useT } from "@/lib/i18n/I18nProvider";
import { Icon } from "@/components/Icon";
import { PrintSlip, usePrintOnce, type PrintJob } from "@/components/pos/PrintSlip";
import { Barcode } from "@/app/products/labels/LabelSheet";

type State = "untested" | "ok" | "problem" | "none";
type Key = "internet" | "printer" | "drawer" | "labels" | "scanner" | "scale" | "phone";

interface Item {
  variantId: string;
  name: string;
  barcode: string | null;
  soldByWeight: boolean;
}

/** What to do when a device does not work, in plain words. */
const FIX: Record<Key, string> = {
  internet:
    "Check the Wi-Fi or the cable, then restart the router. The till keeps selling quick sales and table bills meanwhile, and sends them when the internet is back.",
  printer:
    "Check the printer is on, has paper and is chosen in the print dialog. Set the paper to 80 mm and the margins to none, then try again.",
  drawer:
    "In the receipt printer's settings on this computer, turn on opening the cash drawer when printing. Check the drawer's cable is in the printer's drawer socket.",
  labels:
    "Check the label printer is on, has labels and is chosen in the print dialog, with the label's size as its paper.",
  scanner:
    "Click in the box first, then scan. Check the scanner is plugged in and set to press Enter after each code.",
  scale:
    "Set the scale to print EAN-13 labels starting with 2, and give each weighed product the scale's product code as its barcode on Products & Recipes.",
  phone: "On the phone, open My account, turn on Phone warnings and press Send a test.",
};

/**
 * Test your devices (G4): each of the till's devices tried in turn. A printed
 * test asks whether it came out right; the scanner and the scale are read as
 * the till reads them; the internet is timed. Nothing is a sale, and nothing
 * is kept but this screen's ticks.
 */
export function DevicesCheck({
  businessName,
  timezone,
  items,
}: {
  businessName: string;
  timezone: string;
  items: Item[];
}) {
  const { t } = useT();
  const [state, setState] = useState<Record<Key, State>>({
    internet: "untested",
    printer: "untested",
    drawer: "untested",
    labels: "untested",
    scanner: "untested",
    scale: "untested",
    phone: "untested",
  });
  const mark = (k: Key, s: State) => setState((x) => ({ ...x, [k]: s }));

  // ------------------------------------------------------------ the internet
  const [net, setNet] = useState<string | null>(null);
  async function testInternet() {
    setNet(t("Checking…"));
    if (!navigator.onLine) {
      setNet(t("This device says it has no connection."));
      return mark("internet", "problem");
    }
    const started = performance.now();
    try {
      const r = await fetch("/api/ping", { cache: "no-store" });
      const ms = Math.round(performance.now() - started);
      const body = (await r.json().catch(() => ({}))) as { ok?: boolean };
      if (!r.ok || !body.ok) {
        setNet(t("The app answered, but the database did not."));
        return mark("internet", "problem");
      }
      setNet(
        ms > 1500
          ? t("Slow: the database answered in {ms} ms. Sales still work; pages open slowly.", {
              ms: String(ms),
            })
          : t("Good: the database answered in {ms} ms.", { ms: String(ms) }),
      );
      mark("internet", ms > 3000 ? "problem" : "ok");
    } catch {
      setNet(t("No answer from the app."));
      mark("internet", "problem");
    }
  }

  // ------------------------------------------------------------ printing
  const [slips, setSlips] = useState<PrintJob[] | null>(null);
  const [labelOn, setLabelOn] = useState(false);
  const testLabel = items.find((i) => i.barcode) ?? null;
  function printReceipt() {
    setSlips([
      {
        kind: "receipt",
        title: t("Test receipt"),
        channelLabel: t("Test your devices"),
        lines: [
          { name: t("Test line"), qty: 1, price: 1000, amount: 1000, note: null },
          { name: t("Another test line"), qty: 2, price: 500, amount: 1000, note: null },
        ],
        total: 2000,
        tender: "cash",
        received: 2000,
        change: 0,
        reference: t("Not a sale"),
        at: new Date().toISOString(),
        by: t("Test your devices"),
      },
    ]);
  }

  // ------------------------------------------------------------ the scanner and the scale
  const [scan, setScan] = useState("");
  const [scanSaid, setScanSaid] = useState<string | null>(null);
  const [scaleSaid, setScaleSaid] = useState<string | null>(null);
  const keyTimes = useRef<number[]>([]);
  function readCode(code: string) {
    const times = keyTimes.current;
    keyTimes.current = [];
    const gaps = times.slice(1).map((x, i) => x - times[i]!);
    const fast = gaps.length >= 3 && gaps.every((g) => g < 60);
    const hit = readScan(code, items);
    const item = hit ? items.find((i) => i.variantId === hit.variantId) : null;
    if (hit && hit.kg !== null && item) {
      setScaleSaid(
        t("Read the scale's label: {name}, {weight}.", {
          name: item.name,
          weight: fmtWeight(hit.kg),
        }),
      );
      mark("scale", "ok");
      return;
    }
    if (/^2\d{12}$/.test(code)) {
      setScaleSaid(t("A scale's label, but no weighed product has its product code."));
      mark("scale", "problem");
      return;
    }
    if (!fast) {
      setScanSaid(t("That was typed, not scanned. Scan a code into the box."));
      return;
    }
    setScanSaid(
      item
        ? t("Scanned: {code}, which is {name}.", { code, name: item.name })
        : t("Scanned: {code}. No product has this barcode yet: add it on Products & Recipes.", {
            code,
          }),
    );
    mark("scanner", "ok");
  }

  const tried = Object.values(state).filter((s) => s !== "untested").length;
  const problems = Object.values(state).filter((s) => s === "problem").length;

  return (
    <div className="grid" style={{ gap: 12 }} data-testid="devices">
      <p className="muted" style={{ margin: 0 }} data-testid="devices-summary">
        {problems > 0
          ? t("{n} device(s) need attention.", { n: String(problems) })
          : t("{n} of 7 tried.", { n: String(tried) })}
      </p>

      <Row k="internet" s={state.internet} onMark={mark} title={t("The internet")}>
        <div>
          <button
            type="button"
            className="btn-primary"
            onClick={testInternet}
            data-testid="device-internet-test"
          >
            {t("Check the connection")}
          </button>
        </div>
        {net && <p style={{ margin: 0 }}>{net}</p>}
      </Row>

      <Row
        k="printer"
        s={state.printer}
        onMark={mark}
        title={t("The receipt printer")}
        yesNo={slips === null ? undefined : t("Did it print, easy to read?")}
      >
        <div>
          <button
            type="button"
            className="btn-primary"
            onClick={printReceipt}
            data-testid="device-printer-test"
          >
            <Icon name="print" /> {t("Print a test receipt")}
          </button>
        </div>
      </Row>

      <Row
        k="drawer"
        s={state.drawer}
        onMark={mark}
        title={t("The cash drawer")}
        yesNo={t("Did the drawer open when the test receipt printed?")}
        noneLabel={t("The drawer is not on the printer")}
      >
        <p className="muted" style={{ margin: 0 }}>
          {t(
            "A drawer plugged into the receipt printer opens when a receipt prints. Print the test receipt above, then say.",
          )}
        </p>
      </Row>

      <Row
        k="labels"
        s={state.labels}
        onMark={mark}
        title={t("The label printer")}
        yesNo={labelOn ? t("Did the label print, its bars sharp?") : undefined}
        noneLabel={t("No label printer here")}
      >
        <div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setLabelOn(true)}
            data-testid="device-labels-test"
          >
            <Icon name="tag" /> {t("Print a test label")}
          </button>
        </div>
      </Row>

      <Row k="scanner" s={state.scanner} onMark={mark} title={t("The barcode scanner")}>
        <input
          value={scan}
          inputMode="none"
          placeholder={t("Click here, then scan any barcode")}
          aria-label={t("Click here, then scan any barcode")}
          onKeyDown={(e) => {
            keyTimes.current.push(performance.now());
            if (e.key === "Enter") {
              e.preventDefault();
              if (scan.trim()) readCode(scan.trim());
              setScan("");
            }
          }}
          onChange={(e) => setScan(e.target.value)}
          data-testid="device-scan"
        />
        {scanSaid && (
          <p style={{ margin: 0 }} data-testid="device-scan-said">
            {scanSaid}
          </p>
        )}
        <div>
          <button type="button" onClick={() => mark("scanner", "none")}>
            {t("No scanner here")}
          </button>
        </div>
      </Row>

      <Row k="scale" s={state.scale} onMark={mark} title={t("The scale's labels")}>
        <p className="muted" style={{ margin: 0 }}>
          {t(
            "Weigh something sold by weight, print its label on the scale, and scan it into the box above.",
          )}
        </p>
        {scaleSaid && (
          <p style={{ margin: 0 }} data-testid="device-scale-said">
            {scaleSaid}
          </p>
        )}
        <div>
          <button type="button" onClick={() => mark("scale", "none")}>
            {t("Nothing is sold by weight here")}
          </button>
        </div>
      </Row>

      <Row
        k="phone"
        s={state.phone}
        onMark={mark}
        title={t("Warnings on the phone")}
        yesNo={t("Did the test warning reach the phone?")}
        noneLabel={t("Not used")}
      >
        <p className="muted" style={{ margin: 0 }}>
          {t("On the phone that should get the café's warnings, open")}{" "}
          <Link href="/account">{t("nav.account")}</Link> {t("and press Send a test.")}
        </p>
      </Row>

      {slips && (
        <PrintSlip
          slips={slips}
          businessName={businessName}
          timezone={timezone}
          onDone={() => setSlips(slips.length ? [] : null)}
        />
      )}
      {labelOn && <TestLabel item={testLabel} onDone={() => setLabelOn(false)} />}
    </div>
  );
}

/** One device: its state, how it is tried, and what to do when it does not work. */
function Row({
  k,
  s,
  title,
  children,
  yesNo,
  noneLabel,
  onMark,
}: {
  k: Key;
  s: State;
  title: string;
  children: React.ReactNode;
  yesNo?: string;
  noneLabel?: string;
  onMark: (k: Key, s: State) => void;
}) {
  const { t } = useT();
  return (
    <section
      className={`card device-row${s === "problem" ? " bad" : s === "ok" ? " good" : ""}`}
      data-testid={`device-${k}`}
      data-state={s}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, flex: 1 }}>{title}</h3>
        <span className={`badge ${s === "ok" ? "ok" : s === "problem" ? "err" : ""}`}>
          {s === "ok"
            ? t("Works")
            : s === "problem"
              ? t("Needs attention")
              : s === "none"
                ? t("Not used here")
                : t("Not tried yet")}
        </span>
      </div>
      <div className="grid" style={{ gap: 8, marginTop: 8 }}>
        {children}
        {yesNo && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span className="muted">{yesNo}</span>
            <button type="button" onClick={() => onMark(k, "ok")} data-testid={`device-${k}-yes`}>
              {t("Yes")}
            </button>
            <button
              type="button"
              onClick={() => onMark(k, "problem")}
              data-testid={`device-${k}-no`}
            >
              {t("No")}
            </button>
            {noneLabel && (
              <button type="button" onClick={() => onMark(k, "none")}>
                {noneLabel}
              </button>
            )}
          </div>
        )}
        {s === "problem" && (
          <p className="red" style={{ margin: 0 }} data-testid={`device-${k}-fix`}>
            <Icon name="alert" size={14} /> {t(FIX[k])}
          </p>
        )}
      </div>
    </section>
  );
}

/** A label as the label sheet prints it: the café's own product if one has a barcode. */
function TestLabel({ item, onDone }: { item: Item | null; onDone: () => void }) {
  const { t, dir, locale } = useT();
  const done = useRef(onDone);
  done.current = onDone;
  const [job] = useState(() => ({}));
  usePrintOnce(job, () => done.current());
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="print-slip" dir={dir} lang={locale}>
      <div className="label-cell" data-testid="device-label">
        <b dir="auto">{item?.name ?? t("Test label")}</b>
        <Barcode code={item?.barcode ?? "2900000000008"} height={36} />
      </div>
    </div>,
    document.body,
  );
}
