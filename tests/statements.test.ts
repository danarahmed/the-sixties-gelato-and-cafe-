/**
 * Statements read from their files (the roadmap's "statements read from their
 * files"): a delivery platform's, matched to the orders waiting to be paid
 * out, and the bank's, found among the books' bank lines. What a file holds
 * is read in the browser (src/lib/sheet.ts): an Excel workbook as Excel and
 * other programs write one, a CSV or text file in whatever encoding it came
 * in, and the web page or XML some banks give as an ".xls".
 */
import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decodeText, readStatementFile, readTable, toTsv } from "@/lib/sheet";
import { decimalMark, parseStatement, statementAmount } from "@/lib/settlements";
import {
  BANK_EXAMPLE,
  dayOrder,
  expenseFromLink,
  expenseLink,
  journalFromLink,
  journalLink,
  matchBankStatement,
  parseBankStatement,
  recordLink,
  statementDay,
  type BankOpenLine,
} from "@/lib/bank";
import { builtInWords } from "@/lib/i18n/dictionaries";
import { messenger } from "@/lib/i18n/core";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`./statement-files/${name}`, import.meta.url)));

async function read(bytes: Uint8Array): Promise<string> {
  const r = await readStatementFile(bytes);
  if (!r.ok) throw new Error(r.error);
  return r.text;
}

const utf8 = (s: string) => new TextEncoder().encode(s);

// --- A zip, as a workbook is one: to make a workbook part by part --------------------

function crc32(b: Uint8Array): number {
  let crc = 0xffffffff;
  for (const x of b) {
    let c = (crc ^ x) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** A zip of the parts, each packed (deflated) or kept as it is (stored). */
function zip(parts: Record<string, string>, packed: boolean): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const le = (n: number, bytes: number) => {
    const out = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i++) out[i] = (n >>> (8 * i)) & 0xff;
    return out;
  };
  const join = (xs: Uint8Array[]) => {
    const out = new Uint8Array(xs.reduce((s, x) => s + x.length, 0));
    let o = 0;
    for (const x of xs) {
      out.set(x, o);
      o += x.length;
    }
    return out;
  };
  for (const [name, text] of Object.entries(parts)) {
    const raw = utf8(text);
    const data = packed ? new Uint8Array(deflateRawSync(raw)) : raw;
    const n = utf8(name);
    const common = join([
      le(20, 2),
      le(0, 2),
      le(packed ? 8 : 0, 2),
      le(0, 4),
      le(crc32(raw), 4),
      le(data.length, 4),
      le(raw.length, 4),
      le(n.length, 2),
      le(0, 2),
    ]);
    const local = join([le(0x04034b50, 4), common, n, data]);
    central.push(
      join([le(0x02014b50, 4), le(20, 2), common, le(0, 2), le(0, 2), le(0, 2), le(0, 4)]),
    );
    central[central.length - 1] = join([central[central.length - 1]!, le(offset, 4), n]);
    chunks.push(local);
    offset += local.length;
  }
  const dir = join(central);
  const end = join([
    le(0x06054b50, 4),
    le(0, 2),
    le(0, 2),
    le(central.length, 2),
    le(central.length, 2),
    le(dir.length, 4),
    le(offset, 4),
    le(0, 2),
  ]);
  return join([...chunks, dir, end]);
}

const NS = 'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** A workbook as a program other than Excel may write one: prefixes, inline strings, 1904 dates. */
function oddWorkbook(packed: boolean): Uint8Array {
  return zip(
    {
      "_rels/.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="${REL}/officeDocument" Target="/book/main.xml"/></Relationships>`,
      "book/main.xml": `<x:workbook ${NS} xmlns:r="${REL}"><x:workbookPr date1904="1"/><x:sheets><x:sheet name="Empty &gt; one" sheetId="1" r:id="s1"/><x:sheet name="Data" sheetId="2" r:id="s2"/></x:sheets></x:workbook>`,
      "book/_rels/main.xml.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="s1" Type="${REL}/worksheet" Target="sheets/empty.xml"/><Relationship Id="s2" Type="${REL}/worksheet" Target="./sheets/../sheets/data.xml"/><Relationship Id="st" Type="${REL}/styles" Target="look.xml"/><Relationship Id="ss" Type="${REL}/sharedStrings" Target="words.xml"/></Relationships>`,
      "book/look.xml": `<x:styleSheet ${NS}><x:numFmts count="1"><x:numFmt numFmtId="170" formatCode="[$-409]d\\-mmm\\-yy;@"/></x:numFmts><x:cellStyleXfs count="1"><x:xf numFmtId="14"/></x:cellStyleXfs><x:cellXfs count="3"><x:xf numFmtId="0"/><x:xf numFmtId="170" applyNumberFormat="1"><x:alignment horizontal="left"/></x:xf><x:xf numFmtId="4"/></x:cellXfs></x:styleSheet>`,
      "book/words.xml": `<x:sst ${NS} count="2"><x:si><x:r><x:t>Order </x:t></x:r><x:r><x:rPr><x:b/></x:rPr><x:t xml:space="preserve">ID</x:t></x:r><x:rPh sb="0" eb="1"><x:t>オーダー</x:t></x:rPh></x:si><x:si><x:t>Tom &amp; Jerry_x000D_
line</x:t></x:si></x:sst>`,
      "book/sheets/empty.xml": `<x:worksheet ${NS}><x:sheetData/></x:worksheet>`,
      "book/sheets/data.xml": `<x:worksheet ${NS}><x:sheetData><x:row r="2"><x:c r="A2" t="s"><x:v>0</x:v></x:c><x:c r="C2" t="inlineStr"><x:is><x:t>Payout</x:t></x:is></x:c></x:row><x:row><x:c t="s"><x:v>1</x:v></x:c><x:c s="1"><x:v>44817</x:v></x:c><x:c s="2"><x:v>2549.9999999999995</x:v></x:c><x:c t="b"><x:v>1</x:v></x:c><x:c t="d"><x:v>2026-09-14T10:32:00</x:v></x:c><x:c t="e"><x:v>#N/A</x:v></x:c><x:c r="XFD3"><x:v>1</x:v></x:c></x:row><x:row r="1048576"><x:c r="A1048576"><x:v>7</x:v></x:c></x:row></x:sheetData></x:worksheet>`,
    },
    packed,
  );
}

// --- A table, pasted or read --------------------------------------------------------

describe("a table, pasted or read from a file", () => {
  it("is split by tabs, semicolons or commas, whichever most of its lines use", () => {
    const tabs = readTable("Statement, September\nOrder\tPayout\n5501\t2,550");
    expect(tabs.map((r) => r.cells)).toEqual([
      ["Statement, September"],
      ["Order", "Payout"],
      ["5501", "2,550"],
    ]);
    const semicolons = readTable("Order;Payout\n5501;2,550\n5502;1,000.50\n5503;900");
    expect(semicolons[1]!.cells).toEqual(["5501", "2,550"]);
    expect(readTable('5501,"2,550",450').map((r) => r.cells)).toEqual([["5501", "2,550", "450"]]);
  });

  it("keeps a quoted cell whole across lines, and says the line each row starts on", () => {
    const rows = readTable('Order,Note\n5501,"left at\nthe door"\n5502,"say ""hi"""\n');
    expect(rows.map((r) => [r.line, ...r.cells])).toEqual([
      [1, "Order", "Note"],
      [2, "5501", "left at the door"],
      [4, "5502", 'say "hi"'],
    ]);
  });

  it("reads a quote left open line by line, as it was typed", () => {
    const rows = readTable('Order,Payout\n"5501,2550\n5502,900');
    expect(rows.map((r) => r.cells)).toEqual([["Order", "Payout"], ["5501,2550"], ["5502", "900"]]);
  });

  it("drops the marks that set a text's direction, which show as nothing", () => {
    const rows = readTable(
      "\u{FEFF}\u{200F}التاريخ\u{200F}\tالمبلغ\n\u{2066}2026-09-14\u{2069}\t1,500",
    );
    expect(rows.map((r) => r.cells)).toEqual([
      ["التاريخ", "المبلغ"],
      ["2026-09-14", "1,500"],
    ]);
  });

  it("goes out as tab-separated text and comes back the same", () => {
    const rows = [
      ["Order", "Note", "", ""],
      ['"Quoted" at the start', "a\ttab and a\nline break", 'mid "quote"'],
      [],
      ["5501", "2,550"],
    ];
    const text = toTsv(rows);
    expect(text).toBe(
      'Order\tNote\n"""Quoted"" at the start"\ta tab and a line break\tmid "quote"\n\n5501\t2,550',
    );
    expect(readTable(text).map((r) => r.cells)).toEqual([
      ["Order", "Note"],
      ['"Quoted" at the start', "a tab and a line break", 'mid "quote"'],
      [""],
      ["5501", "2,550"],
    ]);
  });
});

describe("a file's words", () => {
  const words = "التاريخ,المبلغ\n2026-09-14,1500";
  it("in UTF-8, with its mark or without", () => {
    expect(decodeText(utf8(words))).toBe(words);
    expect(decodeText(utf8(`\u{FEFF}${words}`))).toBe(words);
  });

  it("in UTF-16, either way round, with its mark or plainly so", () => {
    const le = new Uint8Array(Buffer.from(`\u{FEFF}${words}`, "utf16le"));
    expect(decodeText(le)).toBe(words);
    const be = le.slice();
    for (let i = 0; i + 1 < be.length; i += 2) [be[i], be[i + 1]] = [le[i + 1]!, le[i]!];
    expect(decodeText(be)).toBe(words);
    expect(decodeText(new Uint8Array(Buffer.from("Date\tAmount", "utf16le")))).toBe("Date\tAmount");
  });

  it("in Windows Arabic, as Excel saves a CSV on a computer set to Arabic", () => {
    // التاريخ,المبلغ in Windows-1256.
    const bytes = new Uint8Array([
      0xc7, 0xe1, 0xca, 0xc7, 0xd1, 0xed, 0xce, 0x2c, 0xc7, 0xe1, 0xe3, 0xc8, 0xe1, 0xdb,
    ]);
    expect(decodeText(bytes)).toBe("التاريخ,المبلغ");
  });
});

// --- The files a statement comes in --------------------------------------------------

describe("a statement's file", () => {
  it("an Excel workbook as Excel writes one: shared words, dates as dates, a formula's value", async () => {
    expect((await read(fixture("talabat-statement.xlsx"))).split("\n")).toEqual([
      "Talabat vendor statement",
      "Period\t2026-09-01 to 2026-09-15",
      "",
      "Order ID\tOrder Date\tOrder Value\tCommission\tNet Payout",
      "FILE-7001\t2026-09-14\t3000\t-450\t2550",
      "FILE-7002\t2026-09-14\t6000\t-900\t5100",
      "Total\t\t9000\t-1350\t7650",
      "",
      "Generated on 30/09/2026 by the platform",
    ]);
  });

  it("one another program writes: words kept in each cell, a date and time shown as a day", async () => {
    expect((await read(fixture("bank-en.xlsx"))).split("\n")).toEqual([
      "Account statement",
      "Account\t0123-456789-001",
      "",
      "Date\tDescription\tDebit\tCredit\tBalance",
      "2026-09-16\tBank charge\t5000\t\t1745000",
      "2026-09-15\tCard settlement\t\t250000\t1750000",
      "2026-09-14\tTransfer to Baghdad Dairy\t500000\t\t1500000",
      "2026-09-13\tOpening balance\t\t\t2000000",
    ]);
  });

  it("one in Arabic, right to left, its balance worked out by formulas", async () => {
    expect((await read(fixture("bank-ar.xlsx"))).split("\n")).toEqual([
      "كشف حساب",
      "التاريخ\tالبيان\tمدين\tدائن\tالرصيد",
      "2026-09-13\tرصيد افتتاحي\t\t\t2000000",
      "2026-09-14\tحوالة إلى ألبان بغداد\t500000\t\t1500000",
      "2026-09-15\tتسوية بطاقات\t\t250000\t1750000",
      "2026-09-16\tعمولة البنك\t5000\t\t1745000",
      "\tالمجموع\t505000\t250000",
    ]);
  });

  it("any workbook: its first sheet with something on it, however its parts are named", async () => {
    for (const packed of [true, false]) {
      expect((await read(oddWorkbook(packed))).split("\n")).toEqual([
        "Order ID\t\tPayout",
        // 44817 in the 1904 system is 2026-09-14 (2022-09-13 in the 1900 one); a sum's 17 digits as it shows.
        "Tom & Jerry line\t2026-09-14\t2550\tTRUE\t2026-09-14 10:32\t#N/A",
      ]);
    }
  });

  it("a web page some banks give as an .xls, and Excel 2003's XML", async () => {
    const page = `<html><head><style>td{color:red}</style></head><body>
      <table><tr><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th></tr>
      <tr><td>14/09/2026<td>Rent&nbsp;for <b>Sept</b> &amp; more<td>500,000<td></tr>
      <tr><td colspan="2">Total</td><td>500,000</td></tr></table></body></html>`;
    expect(await read(utf8(page))).toBe(
      "Date\tDescription\tDebit\tCredit\n14/09/2026\tRent for Sept & more\t500,000\nTotal\t\t500,000",
    );
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="S"><Table>
      <Row><Cell><Data ss:Type="String">Date</Data></Cell><Cell ss:Index="3"><Data ss:Type="String">Amount</Data></Cell></Row>
      <Row ss:Index="3"><Cell><Data ss:Type="DateTime">2026-09-14T00:00:00.000</Data></Cell><Cell><Data ss:Type="String">Fee</Data></Cell><Cell><Data ss:Type="Number">-5000</Data></Cell></Row>
      </Table></Worksheet></Workbook>`;
    expect(await read(utf8(xml))).toBe("Date\t\tAmount\n\n2026-09-14\tFee\t-5000");
  });

  it("a CSV in Windows Arabic, as tab-separated text", async () => {
    const bytes = new Uint8Array([
      0xc7, 0xe1, 0xca, 0xc7, 0xd1, 0xed, 0xce, 0x2c, 0x22, 0x31, 0x2c, 0x35, 0x30, 0x30, 0x22,
    ]);
    expect(await read(bytes)).toBe("التاريخ\t1,500");
  });

  it("says why a file is not read, and what to choose instead", async () => {
    const no = async (bytes: Uint8Array) => {
      const r = await readStatementFile(bytes);
      return r.ok ? null : r.error;
    };
    expect(await no(new Uint8Array())).toBe("There is nothing in the file to read.");
    expect(await no(utf8("\n \n"))).toBe("There is nothing in the file to read.");
    expect(await no(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0]))).toMatch(
      /^An Excel 97–2003 file \(\.xls\) is not read/,
    );
    expect(await no(utf8("%PDF-1.7\n..."))).toMatch(/^A PDF is not read/);
    expect(await no(zip({ "hello.txt": "hi" }, true))).toBe(
      "The file is not a table: choose the statement's Excel or CSV file.",
    );
    expect(await no(utf8("PK\u{3}\u{4}and then nothing a zip has"))).toBe(
      "The file is not a table: choose the statement's Excel or CSV file.",
    );
    expect(await no(utf8("<html><body>No table here</body></html>"))).toBe(
      "The file is not a table: choose the statement's Excel or CSV file.",
    );
    expect(await no(new Uint8Array(10 * 1024 * 1024 + 1))).toMatch(/^The file is over 10 MB/);
  });
});

// --- A delivery platform's statement ------------------------------------------------

describe("a delivery platform's statement, from its file", () => {
  it("finds the column names below the report's title, and leaves out its total and its note", async () => {
    const p = parseStatement(await read(fixture("talabat-statement.xlsx")));
    expect(p.problems).toEqual([]);
    expect(p.columns).toEqual({
      orderNo: "Order ID",
      payout: "Net Payout",
      commission: "Commission",
      fees: null,
    });
    expect(p.lines).toEqual([
      { orderNo: "FILE-7001", payout: "2550", commission: "450", fees: null },
      { orderNo: "FILE-7002", payout: "5100", commission: "900", fees: null },
    ]);
    expect([p.skipped, p.other]).toEqual([1, 3]);
  });

  it("a total's row however it is named, and a note among the lines", () => {
    const p = parseStatement(
      [
        "Order\tPayout",
        "5501\t2,550",
        "Page 1 of 2",
        "5502\t900",
        "Total orders: 2\t3,450",
        "إجمالي المدفوعات\t3,450",
      ].join("\n"),
    );
    expect(p.problems).toEqual([]);
    expect(p.lines.map((l) => l.orderNo)).toEqual(["5501", "5502"]);
    expect([p.skipped, p.other]).toEqual([2, 1]);
  });

  it("every column of fees added up, and a commission named with the platform's name", () => {
    const p = parseStatement(
      [
        "Order Number;Gross;Talabat Commission;Delivery fee;Payment Fees;Total charges;Payout",
        "C-1001;10,000;-1,500;-500;-100;-2,100;7,900",
        "C-1002;5,000;-750;;;-750;4,250",
      ].join("\n"),
    );
    expect(p.problems).toEqual([]);
    expect(p.columns).toEqual({
      orderNo: "Order Number",
      payout: "Payout",
      commission: "Talabat Commission",
      fees: "Delivery fee, Payment Fees",
    });
    expect(p.lines).toEqual([
      { orderNo: "C-1001", payout: "7900", commission: "1500", fees: "600" },
      { orderNo: "C-1002", payout: "4250", commission: "750", fees: null },
    ]);
    const bad = parseStatement("Order;Payout;Delivery fee;Service fee\n5501;2550;100;n/a");
    expect(bad.problems).toEqual(['Line 2 (order 5501): the fees "n/a" is not an amount.']);
  });

  it("what a platform took in all, as its fees only when nothing else says so", () => {
    expect(parseStatement("Order\tPayout\tDeductions\n5501\t2550\t450").lines).toEqual([
      { orderNo: "5501", payout: "2550", commission: null, fees: "450" },
    ]);
    expect(parseStatement("Order\tPayout\tFees\tDeductions\n5501\t2550\t50\t450").lines).toEqual([
      { orderNo: "5501", payout: "2550", commission: null, fees: "50" },
    ]);
  });

  it("still says what is wrong with a line that has an amount", () => {
    const p = parseStatement(
      "Order\tPayout\nAdj. #12: late\t-1,000\n5501\t\nDelivery adjustment\t-500",
    );
    expect(p.problems).toEqual([
      'Line 2: "Adj. #12: late" is not an order number.',
      "Line 3 (order 5501) has no payout.",
    ]);
    // Letters alone may be an order number: the match says whether a sale has it.
    expect(p.lines).toEqual([
      { orderNo: "Deliveryadjustment", payout: "-500", commission: null, fees: null },
    ]);
  });
});

// --- The bank's statement -----------------------------------------------------------

describe("a date as a statement prints it", () => {
  it("in the forms banks use, day before month unless the statement shows otherwise", () => {
    for (const cell of [
      "2026-09-14",
      "2026/09/14 10:32",
      "14/09/2026",
      "14-09-26",
      "14.09.2026 23:59:00",
      "14 Sep 2026",
      "14-Sept-2026",
      "Sep 14, 2026",
      "September 14th 2026",
      "١٤/٠٩/٢٠٢٦",
      "۱۴/۰۹/۲۰۲۶",
      "46279",
    ])
      expect([cell, statementDay(cell)]).toEqual([cell, "2026-09-14"]);
    expect(statementDay("09/14/2026", "mdy")).toBe("2026-09-14");
    expect(statementDay("03/04/2026")).toBe("2026-04-03");
    expect(statementDay("03/04/2026", "mdy")).toBe("2026-03-04");
    for (const cell of ["31/02/2026", "2026-13-01", "Balance", "", "12345", "14/09/1890"])
      expect([cell, statementDay(cell)]).toEqual([cell, null]);
  });

  it("month first only when a date on the statement says so", () => {
    expect(dayOrder(["01/02/2026", "13/02/2026"])).toBe("dmy");
    expect(dayOrder(["", "02/13/2026", "02/14/2026"])).toBe("mdy");
    expect(dayOrder(["01/02/2026", "2026-09-14"])).toBe("dmy");
  });
});

describe("the bank's statement, read", () => {
  it("from an Excel file with the newest line first: put in the order it happened", async () => {
    const p = parseBankStatement(await read(fixture("bank-en.xlsx")));
    expect(p.problems).toEqual([]);
    expect(p.columns).toEqual(["Date", "Description", "Credit", "Debit", "Balance"]);
    expect(p.lines).toEqual([
      {
        line: 7,
        day: "2026-09-14",
        description: "Transfer to Baghdad Dairy",
        amount: "-500000",
        balance: "1500000",
      },
      {
        line: 6,
        day: "2026-09-15",
        description: "Card settlement",
        amount: "250000",
        balance: "1750000",
      },
      {
        line: 5,
        day: "2026-09-16",
        description: "Bank charge",
        amount: "-5000",
        balance: "1745000",
      },
    ]);
    // The title, the account, the column names, and the balance brought forward.
    expect(p.skipped).toBe(4);
    expect(p.closing).toBe("1745000");
  });

  it("from one in Arabic, the oldest first, with its total", async () => {
    const p = parseBankStatement(await read(fixture("bank-ar.xlsx")));
    expect(p.problems).toEqual([]);
    expect(p.lines.map((l) => [l.day, l.amount, l.balance])).toEqual([
      ["2026-09-14", "-500000", "1500000"],
      ["2026-09-15", "250000", "1750000"],
      ["2026-09-16", "-5000", "1745000"],
    ]);
    expect([p.skipped, p.closing]).toEqual([4, "1745000"]);
  });

  it("one amount column, by its sign, a DR/CR mark, or a column that says which", () => {
    const signed = parseBankStatement(
      'Date,Details,Amount,Balance\n01/09/2026,Rent,"(1,000,000)",\n02/09/2026,Deposit,500000 CR,\n03/09/2026,Fee,250 DR,-250 DR',
    );
    expect(signed.problems).toEqual([]);
    expect(signed.lines.map((l) => [l.day, l.amount, l.balance])).toEqual([
      ["2026-09-01", "-1000000", null],
      ["2026-09-02", "500000", null],
      ["2026-09-03", "-250", "-250"],
    ]);
    const marked = parseBankStatement(
      "Posting Date\tType\tAmount\n2026-09-01\tD\t1,000\n2026-09-02\tCredit\t-2,000\n2026-09-03\t\t-300",
    );
    expect(marked.lines.map((l) => l.amount)).toEqual(["-1000", "2000", "-300"]);
    expect(marked.columns).toEqual(["Posting Date", "Amount", "Type"]);
  });

  it("a column saying which, in Arabic", () => {
    const p = parseBankStatement(
      "التاريخ,البيان,المبلغ,النوع\n14/09/2026,إيداع,1000,دائن\n15/09/2026,سحب,200,مدين",
    );
    expect(p.lines.map((l) => [l.day, l.amount])).toEqual([
      ["2026-09-14", "1000"],
      ["2026-09-15", "-200"],
    ]);
  });

  it("an empty column as a dash, and a row where no money moved, left out", () => {
    const p = parseBankStatement(
      "Date;Description;Money out;Money in\n01/09/2026;Fee;-;5,000\n02/09/2026;Note;—;0.00\n02/09/2026;Statement fee;2,500;-",
    );
    expect(p.problems).toEqual([]);
    expect(p.lines.map((l) => l.amount)).toEqual(["5000", "-2500"]);
    expect(p.skipped).toBe(2);
  });

  it("as the example on the screen shows it, in each language", () => {
    for (const [locale, example] of Object.entries(BANK_EXAMPLE)) {
      const p = parseBankStatement(example);
      expect([locale, p.problems, p.lines.map((l) => [l.day, l.amount, l.balance])]).toEqual([
        locale,
        [],
        [["2026-09-14", "-500000", "1500000"]],
      ]);
    }
  });

  it("says what cannot be read, by the line it is on", () => {
    const p = parseBankStatement(
      "Account 0123\nDate,Description,Debit,Credit\n01/09/2026,Fee,abc,\n,Cash in,,1000\n32/09/2026,Fee,5,\nnot a date,,,",
    );
    expect(p.problems).toEqual([
      'Line 3: "abc" is not an amount.',
      "Line 4 has an amount but no date.",
      'Line 5: "32/09/2026" is not a date.',
    ]);
    expect(parseBankStatement("Order,Payout\n5501,2550").problems).toEqual([
      "The columns were not recognised. Name them Date, Money in and Money out (or Amount), and Balance if the statement gives it.",
    ]);
  });
});

describe("a statement's amounts and words, read as written (after review)", () => {
  it("never reads a decimal comma as thousands, nor thousands' dots as decimals", () => {
    // Read as the bank wrote them: a dot for decimals, commas between thousands.
    expect(statementAmount("1,234,567")).toBe("1234567");
    expect(statementAmount("(1,500.50)")).toBe("-1500.5");
    expect(statementAmount("١٬٥٠٠٬٠٠٠")).toBe("1500000");
    // Not read, so shown as a problem: 500,00 was read as 50,000, and 2.500,00 as 2.5.
    for (const cell of ["500,00", "2.500,00", "12,34", "1.500.000"])
      expect([cell, statementAmount(cell)]).toEqual([cell, null]);
    // A statement that marks its decimals with a comma is read so.
    expect(statementAmount("2.500,00", ",")).toBe("2500");
    expect(statementAmount("-1.500.000,50", ",")).toBe("-1500000.5");
    expect(statementAmount("500,5", ",")).toBe("500.5");
    expect(statementAmount("1,500.00", ",")).toBeNull();
  });

  it("finds the statement's decimal mark in its own amounts, a dot when nothing shows", () => {
    expect(decimalMark(["", "500,00"])).toBe(",");
    expect(decimalMark(["250.000", "1.250.000"])).toBe(",");
    expect(decimalMark(["2.500,00"])).toBe(",");
    expect(decimalMark(["1,500,000"])).toBe(".");
    expect(decimalMark(["1500.50"])).toBe(".");
    expect(decimalMark(["250.000", "5000"])).toBe(".");
  });

  it("reads a statement with comma decimals, its balances too", () => {
    const p = parseBankStatement(
      "Date;Description;Amount;Balance\n14/09/2026;SMS fee;-500,00;1.500.000,00\n15/09/2026;Deposit;2.500,00;1.502.500,00",
    );
    expect(p.problems).toEqual([]);
    expect(p.lines.map((l) => [l.amount, l.balance])).toEqual([
      ["-500", "1500000"],
      ["2500", "1502500"],
    ]);
  });

  it("says so where one amount in a dot statement has a decimal comma", () => {
    const p = parseBankStatement(
      'Date,Description,Debit,Credit\n14/09/2026,Transfer,"500,000",\n15/09/2026,SMS fee,"500,00",',
    );
    expect(p.lines.map((l) => l.amount)).toEqual(["-500000"]);
    expect(p.problems).toEqual(['Line 3: "500,00" is not an amount.']);
  });

  it("takes in or out from the words banks use, and asks where a word says neither", () => {
    const p = parseBankStatement(
      "Date\tType\tAmount\n01/09/2026\tWithdrawal\t250,000\n02/09/2026\tDeposit\t100,000\n03/09/2026\tDr.\t1,000\n" +
        "04/09/2026\tسحب نقدي\t5,000\n05/09/2026\tحوالة واردة\t7,000\n06/09/2026\tPOS\t3,000",
    );
    expect(p.lines.map((l) => l.amount)).toEqual(["-250000", "100000", "-1000", "-5000", "7000"]);
    expect(p.problems).toEqual(['Line 7: "POS" does not say whether the money went in or out.']);
    // Where the amounts carry their own sign, the type only says what a line is.
    const signed = parseBankStatement(
      "Date\tType\tAmount\n01/09/2026\tPOS\t-3,000\n02/09/2026\tTransfer\t9,000",
    );
    expect([signed.problems, signed.lines.map((l) => l.amount)]).toEqual([[], ["-3000", "9000"]]);
  });

  it("says so where a comma not in quotes splits an amount", () => {
    const p = parseBankStatement(
      "Date,Description,Debit,Credit,Balance\n14/09/2026,Transfer,500,000,,1,500,000\n15/09/2026,Fee,250,,1499750",
    );
    expect(p.problems).toEqual([
      "Line 2 has more cells than the statement has columns: an amount with commas, not in quotes?",
    ]);
    expect(p.lines.map((l) => [l.amount, l.balance])).toEqual([["-250", "1499750"]]);
  });

  it("reads a dated line whose words start with a total's, and leaves out totals and balances", () => {
    const p = parseBankStatement(
      "Date,Description,Debit,Credit\n01/09/2026,Beginning balance,,2000000\n14/09/2026,Total Energies fuel,25000,\n" +
        "15/09/2026,إجمالي رسوم الخدمة,5000,\n,Total,30000,\n30/09/2026,Total,30000,",
    );
    expect(p.problems).toEqual([]);
    expect(p.lines.map((l) => [l.description, l.amount])).toEqual([
      ["Total Energies fuel", "-25000"],
      ["إجمالي رسوم الخدمة", "-5000"],
    ]);
    expect(p.skipped).toBe(4);
  });

  it("does not read a platform's payout with a decimal comma", () => {
    const p = parseStatement("Order\tPayout\n5501\t8.500,00");
    expect(p.lines).toEqual([]);
    expect(p.problems.length).toBe(1);
  });
});

describe("the bank's statement against the books", () => {
  const books: BankOpenLine[] = [
    { lineId: "transfer", day: "2026-09-14", amount: -500000 },
    { lineId: "cards", day: "2026-09-13", amount: 250000 },
    { lineId: "cheque", day: "2026-09-15", amount: -75000 },
    { lineId: "tomorrow", day: "2026-09-17", amount: -5000 },
  ];

  it("finds each line: the same amount, the same day or the nearest within reach", async () => {
    const p = parseBankStatement(await read(fixture("bank-en.xlsx")));
    const m = matchBankStatement(p, books, "2026-09-12");
    expect(m.lines.map((x) => [x.line.day, x.line.amount, x.lineId])).toEqual([
      ["2026-09-14", "-500000", "transfer"],
      ["2026-09-15", "250000", "cards"],
      // The bank's charge is not in the books; the one on the 17th is after the statement ends.
      ["2026-09-16", "-5000", null],
    ]);
    expect(m.ticked.sort()).toEqual(["cards", "transfer"]);
    expect([m.before, m.lastDay, m.opening, m.closing]).toEqual([
      0,
      "2026-09-16",
      "2000000",
      "1745000",
    ]);
  });

  it("leaves out its lines on a statement kept already", async () => {
    const p = parseBankStatement(await read(fixture("bank-ar.xlsx")));
    const m = matchBankStatement(p, books, "2026-09-14");
    expect(m.lines.map((x) => x.line.day)).toEqual(["2026-09-15", "2026-09-16"]);
    expect([m.before, m.opening]).toEqual([1, "1500000"]);
  });

  it("a rent paid every month: each payment to the one nearest it", () => {
    const p = parseBankStatement(
      "Date,Description,Debit\n02/08/2026,Rent,1000000\n01/09/2026,Rent,1000000\n25/09/2026,Rent,1000000",
    );
    const rent: BankOpenLine[] = [
      { lineId: "september", day: "2026-08-31", amount: -1000000 },
      { lineId: "august", day: "2026-08-01", amount: -1000000 },
      { lineId: "june", day: "2026-06-01", amount: -1000000 },
    ];
    const m = matchBankStatement(p, rent, "");
    expect(m.lines.map((x) => x.lineId)).toEqual(["august", "september", null]);
  });
});

describe("a line the bank shows and the books don't, recorded", () => {
  const charge = {
    line: 5,
    day: "2026-09-16",
    description: "عمولة البنك & SMS",
    amount: "-2750",
    balance: null,
  };

  it("opens Expenses filled in, with the way back to the statement", () => {
    const link = expenseLink(charge);
    expect(link.startsWith("/expenses?")).toBe(true);
    const sp = Object.fromEntries(new URLSearchParams(link.split("?")[1]));
    expect(expenseFromLink(sp, "2026-09-30")).toEqual({
      description: "عمولة البنك & SMS",
      amount: "2750",
      date: "2026-09-16",
      paidFrom: "bank",
      back: "/accounting/bank",
    });
  });

  it("money in opens a journal into the bank, its other side to choose", () => {
    const interest = { ...charge, description: "فائدة", amount: "1250" };
    const link = journalLink(interest);
    expect(recordLink(interest)).toBe(link);
    expect(recordLink(charge)).toBe(expenseLink(charge));
    const sp = Object.fromEntries(new URLSearchParams(link.split("?")[1]));
    expect(journalFromLink(sp, "2026-09-30")).toEqual({
      description: "فائدة",
      date: "2026-09-16",
      amount: "1250",
      debit: "1020",
      back: "/accounting/bank",
    });
    // Only money into the bank, with an amount: nothing else is filled in.
    expect(journalFromLink({ ...sp, dr: "1000" }, "2026-09-30")).toBeNull();
    expect(journalFromLink({ ...sp, amount: "0" }, "2026-09-30")).toBeNull();
    expect(journalFromLink({ q: "5501" }, "2026-09-30")).toBeNull();
  });

  it("fills in nothing that could not be one", () => {
    expect(expenseFromLink({}, "2026-09-30")).toBeNull();
    expect(
      expenseFromLink(
        { what: "  ", amount: "-5", on: "2026-10-01", from: "the moon", back: "elsewhere" },
        "2026-09-30",
      ),
    ).toBeNull();
    expect(
      expenseFromLink(
        { amount: "١٬٥٠٠", on: "2026-02-30", from: "safe", what: ["a", "b"] },
        "2026-09-30",
      ),
    ).toEqual({ amount: "1500", paidFrom: "safe", back: null });
    expect(expenseFromLink({ what: "x".repeat(300) }, "2026-09-30")?.description).toHaveLength(200);
  });
});

// --- In the reader's language ---------------------------------------------------------

describe("what a statement's reading says", () => {
  it("is said in Arabic and in Kurdish", async () => {
    const said = new Set<string>();
    const add = (xs: string[]) => xs.forEach((x) => said.add(x));
    add(
      parseBankStatement(
        "Date,Description,Debit,Credit\n01/09/2026,Fee,abc,\n,Cash in,,1000\n32/09/2026,Fee,5,",
      ).problems,
    );
    add(parseBankStatement("Order,Payout\n5501,2550").problems);
    add(
      parseBankStatement(
        "Date,Amount\n" + Array.from({ length: 2001 }, () => "01/09/2026,5").join("\n"),
      ).problems,
    );
    add(parseStatement("Order\tPayout\nDelivery adjustment\t-1,000\n5501\t").problems);
    add(parseBankStatement("Date\tType\tAmount\n01/09/2026\tPOS\t3,000").problems);
    add(parseBankStatement("Date,Description,Debit\n14/09/2026,Transfer,500,000").problems);
    for (const bytes of [
      new Uint8Array(),
      new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      utf8("%PDF-1.7"),
      utf8("<html></html>"),
      new Uint8Array(10 * 1024 * 1024 + 1),
    ]) {
      const r = await readStatementFile(bytes);
      if (!r.ok) said.add(r.error);
    }
    said.add("This browser cannot open Excel files: save the statement as CSV and choose that.");
    said.add("The file could not be read: save it again as .xlsx or CSV, and choose that.");
    expect(said.size).toBeGreaterThanOrEqual(15);
    for (const locale of ["ar", "ckb"]) {
      const msg = messenger(builtInWords(locale), "rtl");
      expect([...said].filter((m) => msg(m) === m)).toEqual([]);
    }
  });
});
