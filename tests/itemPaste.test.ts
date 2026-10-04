import { describe, expect, it } from "vitest";
import {
  cellsOf,
  fold,
  isReady,
  itemInputOf,
  PASTE_PROBLEMS,
  readPaste,
  unitOf,
  type PastedRow,
} from "@/lib/itemPaste";

const MILK = { id: "m", name: "Milk", nameAr: "حليب", nameCkb: "شیر" };
const owner = {
  itemType: "ingredient" as const,
  isOwner: true,
  reason: "The opening count",
  acceptSimilar: false,
};
const keys = (r: PastedRow) => r.problems.map((p) => p.key);

describe("units", () => {
  it("knows g, kg, ml, L and each, however they are written", () => {
    expect(unitOf("kg")?.code).toBe("kg");
    expect(unitOf("KG")?.code).toBe("kg");
    expect(unitOf("Kilo")?.code).toBe("kg");
    expect(unitOf("كغم")?.code).toBe("kg");
    expect(unitOf("کیلۆ")?.code).toBe("kg");
    expect(unitOf("کیلۆگرام")?.code).toBe("kg");
    expect(unitOf("كيلو")?.code).toBe("kg");
    expect(unitOf("L")?.code).toBe("L");
    expect(unitOf("litre")?.code).toBe("L");
    expect(unitOf("لتر")?.code).toBe("L");
    expect(unitOf("لیتر")?.code).toBe("L"); // Kurdish ی, folded to ي
    expect(unitOf("ml")?.code).toBe("ml");
    expect(unitOf("g")?.code).toBe("g");
    expect(unitOf("غرام")?.code).toBe("g");
    expect(unitOf("گرام")?.code).toBe("g");
    expect(unitOf("pcs")?.code).toBe("each");
    expect(unitOf("دانە")?.code).toBe("each"); // ە folded to ه
    expect(unitOf("box")).toBeNull();
    expect(unitOf("kgs.")?.code).toBe("kg");
  });

  it("folds the ways one letter is written", () => {
    expect(fold("کیلۆ")).toBe(fold("كيلۆ"));
    expect(fold("دانە")).toBe("دانه");
    expect(fold(" K g. ")).toBe("kg");
  });
});

describe("a line's cells", () => {
  it("splits at tabs, as Excel and Google Sheets copy", () => {
    expect(cellsOf("Milk\tL\t10\t24\t1,250\tحليب\tشیر")).toEqual([
      "Milk",
      "L",
      "10",
      "24",
      "1,250",
      "حليب",
      "شیر",
    ]);
    expect(cellsOf("Cups\teach\t\t500\t75")).toEqual(["Cups", "each", "", "500", "75"]);
  });

  it("or at semicolons, or bars", () => {
    expect(cellsOf("Sugar; kg; 5; 50; 1000")).toEqual(["Sugar", "kg", "5", "50", "1000"]);
    expect(cellsOf("Sugar | kg | 5")).toEqual(["Sugar", "kg", "5"]);
  });

  it("reads a typed line from its end: the numbers, the unit, then the name", () => {
    expect(cellsOf("Pistachio paste kg 2 5 38,000")).toEqual([
      "Pistachio paste",
      "kg",
      "2",
      "5",
      "38,000",
    ]);
    expect(cellsOf("Milk, L, 10, 24, 1,250")).toEqual(["Milk", "L", "10", "24", "1,250"]);
    expect(cellsOf("Cups 8 oz each 100")).toEqual(["Cups 8 oz", "each", "100"]);
    // No unit: the name is all before the numbers, and the unit is asked for.
    expect(cellsOf("Cups 8oz 100")).toEqual(["Cups 8oz", "", "100"]);
    // A name that is a unit's word is still a name.
    expect(cellsOf("Litre")).toEqual(["Litre", ""]);
  });
});

describe("what was pasted, row by row", () => {
  it("reads each row, its numbers in the unit it gives, and passes over the header and blank lines", () => {
    const rows = readPaste(
      "Name\tUnit\tReorder at\tOn the shelf\tCost each\n\nSugar\tkg\t5\t50\t1,000\nCups\tpcs\t100\t٥٠٠\t75\n",
      [MILK],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      line: 3,
      name: "Sugar",
      unit: { code: "kg", base: "g", factor: 1000 },
      reorder: 5,
      shelf: 50,
      cost: 1000,
      problems: [],
      similar: [],
    });
    expect(rows[1]).toMatchObject({ line: 4, name: "Cups", unit: { code: "each" }, shelf: 500 });
    expect(isReady(rows[0]!, false)).toBe(true);
  });

  it("a first row that is an item is an item", () => {
    expect(readPaste("Sugar\tkg", [])).toHaveLength(1);
  });

  it("says what is wrong with a row", () => {
    const rows = readPaste(
      [
        "\tkg",
        "Ice",
        "Napkins\tbox",
        "Cream\tL\tten",
        "Butter\tkg\t-2",
        "Flour\tkg\t5\t20",
        "Salt\tkg\t\t\t500",
      ].join("\n"),
      [],
    );
    expect(keys(rows[0]!)).toEqual(["Give it a name"]);
    expect(keys(rows[1]!)).toEqual(["Give its unit: g, kg, ml, L or each"]);
    expect(rows[2]!.problems).toEqual([
      { key: "“{unit}” is not a unit here: use g, kg, ml, L or each", vars: { unit: "box" } },
    ]);
    expect(rows[3]!.problems).toEqual([
      { key: "“{value}” is not a number", vars: { value: "ten" } },
    ]);
    expect(rows[4]!.problems).toEqual([{ key: "“{value}” is below zero", vars: { value: "-2" } }]);
    // Stock on the shelf needs what it cost; a cost without stock is no harm.
    expect(rows[5]!.problems).toEqual([{ key: "Give what one {unit} cost", vars: { unit: "kg" } }]);
    expect(rows[6]!.problems).toEqual([]);
    expect(rows.every((r) => r.problems.every((p) => PASTE_PROBLEMS.includes(p.key)))).toBe(true);
    expect(isReady(rows[0]!, true)).toBe(false);
  });

  it("a cost that is not a number is said once", () => {
    const [row] = readPaste("Flour\tkg\t5\t20\tabc", []);
    expect(row!.problems).toEqual([{ key: "“{value}” is not a number", vars: { value: "abc" } }]);
  });

  it("refuses a name in use, and a name in the list twice", () => {
    const rows = readPaste("milk\tL\nSugar\tkg\nSUGAR.\tg", [MILK]);
    expect(rows[0]!.problems).toEqual([
      { key: "There is already an item called “{name}”.", vars: { name: "Milk" } },
    ]);
    expect(rows[1]!.problems).toEqual([]);
    expect(rows[2]!.problems).toEqual([
      { key: "“{name}” is in the list twice (line {line}).", vars: { name: "SUGAR.", line: 2 } },
    ]);
  });

  it("holds back a look-alike until the person says it is another item", () => {
    const rows = readPaste("Milkk\tL\nCream\tL\t\t\t\tحليب", [MILK]);
    expect(rows[0]!.problems).toEqual([]);
    expect(rows[0]!.similar.map((s) => s.name)).toEqual(["Milk"]);
    expect(isReady(rows[0]!, false)).toBe(false);
    expect(isReady(rows[0]!, true)).toBe(true);
    // Its Arabic name is milk's.
    expect(rows[1]!.similar.map((s) => s.name)).toEqual(["Milk"]);
  });
});

describe("what the one-item form would send", () => {
  it("kg: kept in g, its levels and stock in g, its cost a g, bought in kg too", () => {
    const [row] = readPaste(
      "Pistachio paste\tkg\t2\t1.15\t38,000\tمعجون الفستق\tمەعجوونی فستق",
      [],
    );
    expect(itemInputOf(row!, owner)).toEqual({
      name: "Pistachio paste",
      nameAr: "معجون الفستق",
      nameCkb: "مەعجوونی فستق",
      itemType: "ingredient",
      baseUnit: "g",
      dimension: "mass",
      minLevel: "2000",
      openingQty: "1150",
      openingUnitCost: "38",
      openingReason: "The opening count",
      returnable: false,
      pack: { label: "kg", holds: "1000" },
      acceptSimilar: false,
    });
  });

  it("L: kept in ml, a litre's cost a millilitre's", () => {
    const [row] = readPaste("Milk\tL\t10\t24\t1,250", []);
    expect(itemInputOf(row!, owner)).toMatchObject({
      baseUnit: "ml",
      dimension: "volume",
      minLevel: "10000",
      openingQty: "24000",
      openingUnitCost: "1.25",
      pack: { label: "L", holds: "1000" },
    });
  });

  it("g, ml and each as they are, with no other unit", () => {
    const [g, each] = readPaste("Saffron\tg\t\t10\t9000\nLids\teach\t200", []);
    expect(itemInputOf(g!, owner)).toMatchObject({
      baseUnit: "g",
      minLevel: null,
      openingQty: "10",
      openingUnitCost: "9000",
      pack: null,
    });
    expect(itemInputOf(each!, owner)).toMatchObject({
      baseUnit: "each",
      dimension: "count",
      minLevel: "200",
      openingQty: null,
      openingUnitCost: null,
      openingReason: null,
    });
  });

  it("stock on the shelf is the owner's to record: for anyone else it is left out", () => {
    const [row] = readPaste("Milk\tL\t10\t24\t1250", []);
    expect(itemInputOf(row!, { ...owner, isOwner: false })).toMatchObject({
      minLevel: "10000",
      openingQty: null,
      openingUnitCost: null,
      openingReason: null,
    });
  });

  it("nothing on the shelf records no stock, whatever its cost", () => {
    const [row] = readPaste("Milk\tL\t\t0\t1250", []);
    expect(itemInputOf(row!, owner)).toMatchObject({ openingQty: null, openingUnitCost: null });
  });

  it("a look-alike the person said is another item is sent as such", () => {
    const [row] = readPaste("Milkk\tL", [MILK]);
    expect(itemInputOf(row!, { ...owner, acceptSimilar: true }).acceptSimilar).toBe(true);
  });
});
