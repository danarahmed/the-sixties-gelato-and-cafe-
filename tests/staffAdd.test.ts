import { describe, expect, it } from "vitest";
import {
  PERSON_PROBLEMS,
  rowProblems,
  rowsToAdd,
  rowUsed,
  weakPin,
  type PersonRow,
} from "@/lib/staffAdd";
import { builtInWords } from "@/lib/i18n/dictionaries";

let n = 0;
const row = (r: Partial<PersonRow> = {}): PersonRow => ({
  key: `r${++n}`,
  name: "",
  title: "",
  phone: "",
  placeId: "main",
  hiredOn: "2026-10-06",
  loginId: "",
  pin: "",
  ...r,
});

describe("several people added at once (round eight)", () => {
  it("a row left as it came is skipped: its place and day are filled in for it", () => {
    expect(rowUsed(row())).toBe(false);
    expect(rowUsed(row({ placeId: "kitchen", hiredOn: "2026-09-01" }))).toBe(false);
    expect(rowUsed(row({ phone: "0750" }))).toBe(true);
    expect(rowUsed(row({ name: "  " }))).toBe(false);
    expect(rowProblems(row(), [])).toEqual([]);
  });

  it("a row someone wrote in needs a name", () => {
    const r = row({ title: "Barista" });
    expect(rowProblems(r, [r])).toEqual(["Give their name"]);
  });

  it("a PIN as the database takes it: 4 to 8 digits, not one digit over and over, nor a run", () => {
    const check = (pin: string) => {
      const r = row({ name: "Rana", pin });
      return rowProblems(r, [r]);
    };
    expect(check("5820")).toEqual([]);
    expect(check("58204913")).toEqual([]);
    expect(check("123")).toEqual(["A PIN is 4 to 8 digits"]);
    expect(check("123456789")).toEqual(["A PIN is 4 to 8 digits"]);
    expect(check("12a4")).toEqual(["A PIN is 4 to 8 digits"]);
    expect(check("1111")).toEqual(["Choose a PIN that is harder to guess"]);
    expect(check("3456")).toEqual(["Choose a PIN that is harder to guess"]);
    expect(check("8765")).toEqual(["Choose a PIN that is harder to guess"]);
    expect(weakPin("1357")).toBe(false);
  });

  it("one login for one person", () => {
    const a = row({ name: "Rana", loginId: "u1" });
    const b = row({ name: "Shazi", loginId: "u1" });
    const c = row({ name: "Dara", loginId: "u2" });
    const empty = row({ loginId: "" });
    expect(rowProblems(a, [a, b, c, empty])).toEqual(["This login is chosen for someone else too"]);
    expect(rowProblems(c, [a, b, c, empty])).toEqual([]);
  });

  it("the rows ready to add: used, with nothing to put right", () => {
    const a = row({ name: "Rana", pin: "5820" });
    const b = row({ name: "Shazi" });
    const bad = row({ title: "Kitchen" });
    const empty = row();
    expect(rowsToAdd([a, b, bad, empty]).map((r) => r.name)).toEqual(["Rana", "Shazi"]);
  });

  it("every word of the form in Arabic and in Kurdish", () => {
    const words = [
      ...PERSON_PROBLEMS,
      "People to add",
      "+ Add people who work here",
      "PIN (optional)",
      "Remove this row",
      "Another row",
      "Add {n} to the staff",
      "{n} added to the staff.",
      "{name} is added, but the PIN was not set: {why}",
    ];
    for (const locale of ["ar", "ckb"] as const) {
      const book = builtInWords(locale);
      expect(words.filter((w) => !book[w])).toEqual([]);
    }
  });
});
