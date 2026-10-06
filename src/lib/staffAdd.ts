/**
 * Several people added to the staff at once (round eight): the rows of the
 * form, each checked before anything is saved, in the database's own terms —
 * a name, a login no other row has, and a PIN of 4 to 8 digits that is not
 * one digit over and over nor a run like 1234 (0049's set_clock_pin). A row
 * left as it came (only its place and day, which are filled in) is skipped.
 * Pure: the form and the tests read through here.
 */

export interface PersonRow {
  /** The row's own, for the form; never sent. */
  key: string;
  name: string;
  title: string;
  phone: string;
  placeId: string;
  hiredOn: string;
  loginId: string;
  pin: string;
}

export type PersonProblem =
  | "Give their name"
  | "This login is chosen for someone else too"
  | "A PIN is 4 to 8 digits"
  | "Choose a PIN that is harder to guess";

/** A row the person wrote something in: the rest are left out. */
export function rowUsed(r: PersonRow): boolean {
  return [r.name, r.title, r.phone, r.pin, r.loginId].some((v) => v.trim() !== "");
}

/** A PIN the database refuses as too easy to guess (0049): 1111, 1234, 9876. */
export function weakPin(pin: string): boolean {
  return /^(.)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin);
}

/** What keeps a row from being added, in the order the form shows it. */
export function rowProblems(r: PersonRow, rows: readonly PersonRow[]): PersonProblem[] {
  if (!rowUsed(r)) return [];
  const out: PersonProblem[] = [];
  if (r.name.trim() === "") out.push("Give their name");
  if (
    r.loginId !== "" &&
    rows.some((o) => o.key !== r.key && rowUsed(o) && o.loginId === r.loginId)
  )
    out.push("This login is chosen for someone else too");
  const pin = r.pin.trim();
  if (pin !== "") {
    if (!/^[0-9]{4,8}$/.test(pin)) out.push("A PIN is 4 to 8 digits");
    else if (weakPin(pin)) out.push("Choose a PIN that is harder to guess");
  }
  return out;
}

/** The rows ready to add: used, and with nothing to put right. */
export function rowsToAdd(rows: readonly PersonRow[]): PersonRow[] {
  return rows.filter((r) => rowUsed(r) && rowProblems(r, rows).length === 0);
}

/** Every phrase the form may show for a row's problem: each is in the books. */
export const PERSON_PROBLEMS: readonly PersonProblem[] = [
  "Give their name",
  "This login is chosen for someone else too",
  "A PIN is 4 to 8 digits",
  "Choose a PIN that is harder to guess",
];
