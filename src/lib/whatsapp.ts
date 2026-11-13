/**
 * A receipt sent by WhatsApp (plan 11, item 4): the till opens WhatsApp with
 * the receipt written out, to the number the customer gives; the cashier
 * presses send. No WhatsApp account or key is needed, and nothing is stored.
 */
import type { PrintJob } from "@/components/pos/PrintSlip";

/** A phone number as WhatsApp takes it: digits with the country code (Iraq's when it starts 07). */
export function whatsappNumber(raw: string): string | null {
  const latin = raw.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  let digits = latin.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("07")) digits = `964${digits.slice(1)}`;
  digits = digits.replace(/\D/g, "");
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

const money = (n: number) => `${Math.round(n).toLocaleString("en-US")} IQD`;

/** The receipt as a message: the café, each line, and the total. */
export function receiptText(job: PrintJob, words: { total: string; thanks: string }): string {
  const lines = job.lines.map(
    (l) =>
      `${l.weighed ? `${Math.round(l.qty * 1000)} g` : `${l.qty} ×`} ${l.name}${l.amount !== null ? ` — ${money(l.amount)}` : ""}`,
  );
  return [
    job.title,
    ...(job.turnNo ? [`#${job.turnNo}`] : []),
    "",
    ...lines,
    "",
    `${words.total}: ${money(job.total)}`,
    words.thanks,
  ].join("\n");
}

export function whatsappLink(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
