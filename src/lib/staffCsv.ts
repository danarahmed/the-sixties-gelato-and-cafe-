import { toCsv } from "@/lib/csv";
import { dateTimeIn } from "@/lib/dates";
import { PAY_BASIS_LABEL, type StaffMember } from "@/lib/staff";
import type { LinkedPhone } from "@/lib/clock";
import type { T } from "@/lib/i18n/core";

/**
 * The people who work here as a spreadsheet (Staff → Download CSV): a row a
 * person, its headings in the reader's language. Pay, a day's hours, overtime
 * and advances owed only for those who see payroll; whether their phone is
 * linked only for those who manage the staff. Amounts are plain numbers, so a
 * spreadsheet can add them up.
 */
export function staffCsv(
  people: StaffMember[],
  opts: {
    t: T;
    timezone: string;
    seesPay: boolean;
    /** Whose phones are linked; null when the reader may not see it. */
    phones: Record<string, LinkedPhone> | null;
  },
): string {
  const { t, timezone, seesPay, phones } = opts;
  const yes = t("Yes");
  const no = t("No");
  const header = [
    t("Name"),
    t("What they do"),
    t("Phone"),
    t("Where they work"),
    t("Started on"),
    t("Their last day"),
    t("Works here now"),
    t("Login"),
    t("PIN"),
    ...(phones ? [t("Phone linked")] : []),
    t("In now"),
    ...(seesPay
      ? [
          t("How they are paid"),
          t("Pay (IQD)"),
          t("A day's hours"),
          t("Overtime %"),
          t("Advances owed (IQD)"),
        ]
      : []),
  ];
  const rows = people.map((p) => [
    p.name,
    p.title ?? "",
    p.phone ?? "",
    p.location,
    p.hiredOn,
    p.leftOn ?? "",
    p.worksNow ? yes : no,
    p.login ?? "",
    p.hasPin ? t("Set") : t("None yet"),
    ...(phones ? [phones[p.id] ? yes : no] : []),
    p.inSince ? dateTimeIn(timezone, p.inSince) : "",
    ...(seesPay
      ? [
          p.pay?.basis ? t(PAY_BASIS_LABEL[p.pay.basis]) : t("Not set"),
          p.pay?.rate ?? "",
          p.pay ? p.pay.standardHours : "",
          p.pay?.overtimePercent ?? "",
          p.pay?.advanceOwed ?? "",
        ]
      : []),
  ]);
  return toCsv(header, rows);
}

/** staff_2026-10-08.csv */
export const staffCsvName = (today: string) => `staff_${today}.csv`;
