/**
 * A group of add-ons' rule, as the owner chose to set it (round fourteen):
 * one of three cards in place of the fewest and the most a line takes —
 *  - "must": the customer must pick one (the milk);
 *  - "one": optional, one at most (a syrup);
 *  - "several": optional, up to a number or as many as they like (toppings).
 * A group made before with any other rule (two to four, say) is "custom" and
 * keeps its numbers as they are.
 */
export type AddonRule = "must" | "one" | "several" | "custom";

export function ruleOf(min: number, max: number | null): AddonRule {
  if (min === 1 && max === 1) return "must";
  if (min === 0 && max === 1) return "one";
  if (min === 0) return "several";
  return "custom";
}

/** The fewest and the most a line takes, for a card; "several" up to `upTo` (null: no limit). */
export function limitsOf(rule: Exclude<AddonRule, "custom">, upTo: number | null) {
  if (rule === "must") return { min: 1, max: 1 };
  if (rule === "one") return { min: 0, max: 1 };
  return { min: 0, max: upTo };
}

export interface ReadyChoice {
  name: string;
  nameAr: string;
  nameCkb: string;
  /** The price filled in for it (0: free), or null for the owner to give. */
  price: number | null;
}

export interface ReadyGroup {
  key: string;
  name: string;
  nameAr: string;
  nameCkb: string;
  rule: Exclude<AddonRule, "custom">;
  upTo: number | null;
  choices: ReadyChoice[];
}

/**
 * The groups most cafés offer, ready to make in one tap from a product's
 * Add-ons tab: the rule and the choices filled in, in the three languages; the
 * owner gives the prices (those usually free are filled in at 0).
 */
export const READY_GROUPS: ReadyGroup[] = [
  {
    key: "milk",
    name: "Milk",
    nameAr: "الحليب",
    nameCkb: "شیر",
    rule: "must",
    upTo: null,
    choices: [
      { name: "Whole milk", nameAr: "حليب كامل الدسم", nameCkb: "شیری تەواو", price: 0 },
      { name: "Skimmed milk", nameAr: "حليب خالي الدسم", nameCkb: "شیری بێ چەوری", price: 0 },
      { name: "Oat milk", nameAr: "حليب الشوفان", nameCkb: "شیری شۆفان", price: null },
      { name: "Almond milk", nameAr: "حليب اللوز", nameCkb: "شیری بادەم", price: null },
      {
        name: "Lactose-free milk",
        nameAr: "حليب خالٍ من اللاكتوز",
        nameCkb: "شیری بێ لاکتۆز",
        price: null,
      },
    ],
  },
  {
    key: "shots",
    name: "Extra shots",
    nameAr: "شوت إضافي",
    nameCkb: "شۆتی زیادە",
    rule: "several",
    upTo: 3,
    choices: [{ name: "Extra shot", nameAr: "شوت إضافي", nameCkb: "شۆتێکی زیادە", price: null }],
  },
  {
    key: "syrups",
    name: "Syrups",
    nameAr: "النكهات",
    nameCkb: "شەربەتەکان",
    rule: "one",
    upTo: null,
    choices: [
      { name: "Vanilla", nameAr: "فانيلا", nameCkb: "ڤانیلا", price: null },
      { name: "Caramel", nameAr: "كراميل", nameCkb: "کەرامێل", price: null },
      { name: "Hazelnut", nameAr: "بندق", nameCkb: "فندق", price: null },
    ],
  },
  {
    key: "sugar",
    name: "Sugar",
    nameAr: "السكر",
    nameCkb: "شەکر",
    rule: "one",
    upTo: null,
    choices: [
      { name: "No sugar", nameAr: "بدون سكر", nameCkb: "بێ شەکر", price: 0 },
      { name: "Less sugar", nameAr: "سكر قليل", nameCkb: "شەکری کەم", price: 0 },
      { name: "Extra sugar", nameAr: "سكر زيادة", nameCkb: "شەکری زیاد", price: 0 },
    ],
  },
  {
    key: "ice",
    name: "Ice",
    nameAr: "الثلج",
    nameCkb: "سەهۆڵ",
    rule: "one",
    upTo: null,
    choices: [
      { name: "No ice", nameAr: "بدون ثلج", nameCkb: "بێ سەهۆڵ", price: 0 },
      { name: "Less ice", nameAr: "ثلج قليل", nameCkb: "سەهۆڵی کەم", price: 0 },
      { name: "Extra ice", nameAr: "ثلج زيادة", nameCkb: "سەهۆڵی زیاد", price: 0 },
    ],
  },
  {
    key: "toppings",
    name: "Toppings",
    nameAr: "الإضافات",
    nameCkb: "سەرپۆشەکان",
    rule: "several",
    upTo: null,
    choices: [
      {
        name: "Chocolate sauce",
        nameAr: "صوص الشوكولاتة",
        nameCkb: "سۆسی شوکولاتە",
        price: null,
      },
      { name: "Caramel sauce", nameAr: "صوص الكراميل", nameCkb: "سۆسی کەرامێل", price: null },
      { name: "Whipped cream", nameAr: "كريمة مخفوقة", nameCkb: "کرێمی کەفاوی", price: null },
      { name: "Nuts", nameAr: "مكسرات", nameCkb: "چەرەز", price: null },
    ],
  },
];
