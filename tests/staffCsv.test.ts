/**
 * Staff → Download CSV (round twelve): a row a person, the headings in the
 * reader's language; pay only for those who see payroll, linked phones only
 * for those who manage the staff; amounts as plain numbers; names a
 * spreadsheet would run as a formula defused.
 */
import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";
import { staffCsv, staffCsvName } from "@/lib/staffCsv";
import type { StaffMember } from "@/lib/staff";
import { translator } from "@/lib/i18n/core";
import { builtInWords } from "@/lib/i18n/dictionaries";

const base: StaffMember = {
  id: "a",
  name: "Rana Ali",
  phone: "0770 123 4567",
  title: "Barista",
  locationId: "l1",
  location: "Main Branch",
  hiredOn: "2026-09-01",
  leftOn: null,
  worksNow: true,
  appUserId: null,
  login: null,
  hasPin: true,
  inSince: "2026-10-08T14:10:00Z",
  attendanceId: "x",
  paySet: true,
  pay: {
    basis: "monthly",
    rate: 600000,
    standardHours: 8,
    overtimePercent: 150,
    advanceOwed: 50000,
  },
};
const omar: StaffMember = {
  ...base,
  id: "b",
  name: "=Omar",
  phone: null,
  title: null,
  hasPin: false,
  inSince: null,
  leftOn: "2026-09-30",
  worksNow: false,
  pay: { basis: null, rate: null, standardHours: 8, overtimePercent: null, advanceOwed: 0 },
};
const en = translator({});

describe("staffCsv", () => {
  it("writes a row a person, with pay and phones for those who may see them", () => {
    const rows = parseCsv(
      staffCsv([base, omar], {
        t: en,
        timezone: "Asia/Baghdad",
        seesPay: true,
        phones: { a: { linkedAt: "2026-10-01T00:00:00Z", lastUsedAt: null } },
      }),
    );
    expect(rows[0]).toEqual([
      "Name",
      "What they do",
      "Phone",
      "Where they work",
      "Started on",
      "Their last day",
      "Works here now",
      "Login",
      "PIN",
      "Phone linked",
      "In now",
      "How they are paid",
      "Pay (IQD)",
      "A day's hours",
      "Overtime %",
      "Advances owed (IQD)",
    ]);
    expect(rows[1]).toEqual([
      "Rana Ali",
      "Barista",
      "0770 123 4567",
      "Main Branch",
      "2026-09-01",
      "",
      "Yes",
      "",
      "Set",
      "Yes",
      "2026-10-08 17:10",
      "By the month",
      "600000",
      "8",
      "150",
      "50000",
    ]);
    // Read back as written: the leading = was defused on the way out.
    expect(rows[2]?.slice(0, 11)).toEqual([
      "=Omar",
      "",
      "",
      "Main Branch",
      "2026-09-01",
      "2026-09-30",
      "No",
      "",
      "None yet",
      "No",
      "",
    ]);
    expect(rows[2]?.[11]).toBe("Not set");
    expect(rows).toHaveLength(3);
  });

  it("leaves out pay and phones for those who may not see them", () => {
    const text = staffCsv([base], {
      t: en,
      timezone: "Asia/Baghdad",
      seesPay: false,
      phones: null,
    });
    const [head, row] = parseCsv(text);
    expect(head).toHaveLength(10);
    expect(head).not.toContain("Pay (IQD)");
    expect(head).not.toContain("Phone linked");
    expect(row).not.toContain("600000");
  });

  it("defuses a name a spreadsheet would run, and starts with a byte-order mark", () => {
    const text = staffCsv([omar], {
      t: en,
      timezone: "Asia/Baghdad",
      seesPay: false,
      phones: null,
    });
    expect(text.startsWith("﻿")).toBe(true);
    expect(text).toContain("'=Omar");
  });

  it("writes its headings in Kurdish for a Kurdish reader", () => {
    const ckb = translator(builtInWords("ckb"), "rtl", "ckb");
    const [head] = parseCsv(
      staffCsv([base], { t: ckb, timezone: "Asia/Baghdad", seesPay: true, phones: null }),
    );
    expect(head?.some((h) => /[A-Za-z]{3}/.test(h.replace(/PIN|IQD/g, "")))).toBe(false);
  });

  it("is named for the day", () => {
    expect(staffCsvName("2026-10-08")).toBe("staff_2026-10-08.csv");
  });
});
