/**
 * Settings at a glance (the simplification round): what each group of
 * Settings has turned on, said on its folded heading, and what is not set up
 * yet, each with what it gives the café. Pure: the page reads the café's
 * settings and this says them; phrases are given with their values, for t().
 */
import type { ReceiptSetup } from "@/lib/receipt";

export type Said = [phrase: string, values?: Record<string, string | number>];

export interface SettingsFacts {
  /** The café's own ways to pay in use (0069); null before 0069. */
  waysToPay: number | null;
  /** The ways of selling that take a service charge, by name, with their percentage (0090); null before 0090. */
  serviceCharges: { name: string; percent: number }[] | null;
  /** The café's receipt (0091); null before 0091. */
  receipt: ReceiptSetup | null;
  /** Phone warnings turned on for the café (0072); null before 0072. */
  phoneWarnings: boolean | null;
  people: number;
  branches: number;
  places: number;
}

/** The receipt is the café's own once anything of it is given. */
export function receiptIsOwn(r: ReceiptSetup | null): boolean {
  if (!r) return false;
  const { name: _name, qr, ...rest } = r;
  return qr !== "none" || Object.values(rest).some((v) => v !== null && v !== "");
}

export function sellingStatus(f: SettingsFacts): Said[] {
  const out: Said[] = [];
  if (f.serviceCharges !== null)
    out.push(
      f.serviceCharges.length === 0
        ? ["No service charge"]
        : [
            "Service charge on {ways}",
            {
              ways: f.serviceCharges.map((s) => `${s.name} ${s.percent}%`).join(", "),
            },
          ],
    );
  if (f.waysToPay !== null)
    out.push(
      f.waysToPay === 0
        ? ["Cash and card only"]
        : ["{n} way(s) to pay besides cash and card", { n: f.waysToPay }],
    );
  if (f.receipt !== null)
    out.push(receiptIsOwn(f.receipt) ? ["Your own receipt"] : ["The app's own receipt"]);
  return out;
}

export function rulesStatus(f: SettingsFacts): Said[] {
  return f.phoneWarnings === null
    ? []
    : [[f.phoneWarnings ? "Phone warnings on" : "Phone warnings off"]];
}

export function peopleStatus(f: SettingsFacts): Said[] {
  return [["People: {n}", { n: f.people }]];
}

export function placesStatus(f: SettingsFacts): Said[] {
  return [
    ["{n} branch(es)", { n: f.branches }],
    ...(f.places > f.branches
      ? ([["{n} other place(s)", { n: f.places - f.branches }]] as Said[])
      : []),
  ];
}

export interface Todo {
  /** The setting's place on Settings, to open it. */
  anchor: string;
  title: string;
  /** What it gives the café, in one sentence. */
  why: string;
}

/** What is not set up yet, in the order it is most worth doing. */
export function notSetUp(f: SettingsFacts): Todo[] {
  const out: Todo[] = [];
  if (f.receipt !== null && !receiptIsOwn(f.receipt))
    out.push({
      anchor: "receipt",
      title: "Your own receipt",
      why: "Your logo, your name and thanks in three languages, the Wi-Fi and a QR code on every receipt.",
    });
  if (f.waysToPay === 0)
    out.push({
      anchor: "ways-to-pay",
      title: "Ways to pay",
      why: "The apps and banks you are paid through, each with its own account, so their money is counted apart.",
    });
  if (f.phoneWarnings === false)
    out.push({
      anchor: "phone-warnings",
      title: "Phone warnings",
      why: "The Dashboard's warnings sent to your phone within minutes, wherever you are.",
    });
  if (f.serviceCharges !== null && f.serviceCharges.length === 0)
    out.push({
      anchor: "service-charge",
      title: "Service charge",
      why: "A percentage added at the table or wherever you choose, kept apart from the sales.",
    });
  return out;
}
