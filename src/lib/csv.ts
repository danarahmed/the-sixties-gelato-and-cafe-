/**
 * CSV for files a person downloads and uploads again (Settings → Languages):
 * RFC 4180 — fields quoted when they hold a comma, a quote or a line break,
 * quotes doubled — with a byte-order mark so a spreadsheet reads Arabic and
 * Kurdish as they are. Formula-looking text is defused on the way out.
 */

export function csvField(v: string | number): string {
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number)[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(csvField).join(",")).join("\r\n") + "\r\n";
}

/** A CSV file's rows, its cells as written (a defused leading ' taken off). */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const endCell = () => {
    row.push(/^'[=+\-@]/.test(cell) ? cell.slice(1) : cell);
    cell = "";
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quoted) {
      if (c !== '"') cell += c;
      else if (s[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ",") endCell();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      endCell();
      rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    endCell();
    rows.push(row);
  }
  return rows;
}
