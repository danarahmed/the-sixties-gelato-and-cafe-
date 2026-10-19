import type { PhraseBook } from "./types";

/**
 * Selling by weight (round seventeen, 0075): a size sold by the kilo, the
 * till asking its weight, and a weighed line on the order.
 */
const phrases: PhraseBook = {
  // The till.
  "How much does it weigh?": { ar: "كم وزنه؟", ckb: "کێشەکەی چەندە؟" },
  "{price} a kilo": { ar: "{price} للكيلو", ckb: "{price} بۆ کیلۆیەک" },
  Weight: { ar: "الوزن", ckb: "کێش" },
  Unit: { ar: "الوحدة", ckb: "یەکە" },
  grams: { ar: "غرام", ckb: "گرام" },
  kilos: { ar: "كيلو", ckb: "کیلۆ" },
  kg: { ar: "كغ", ckb: "کگم" },
  g: { ar: "غ", ckb: "گم" },
  "Type the weight, or tap one above.": {
    ar: "اكتب الوزن، أو اضغط أحد الأوزان أعلاه.",
    ckb: "کێشەکە بنووسە، یان یەکێک لەوانەی سەرەوە دابگرە.",
  },
  "{kg} kg comes to {amount}": { ar: "{kg} كغ يساوي {amount}", ckb: "{kg} کگم دەکاتە {amount}" },
  "Weigh {name} again": { ar: "أعِد وزن {name}", ckb: "{name} دووبارە بکێشە" },
  // Products & Recipes.
  "Sold by weight": { ar: "يُباع بالوزن", ckb: "بە کێش دەفرۆشرێت" },
  "Tick a size sold by the kilo: its price is the price of a kilo, the till asks how much it weighs, and its recipe is for a kilo.":
    {
      ar: "ضع علامة على الحجم الذي يُباع بالكيلو: سعره سعر الكيلو، ويسأل الصندوق عن وزنه، ووصفته لكيلو واحد.",
      ckb: "ئەو قەبارەیە نیشانە بکە کە بە کیلۆ دەفرۆشرێت: نرخەکەی نرخی کیلۆیەکە، سندوق دەپرسێت کێشەکەی چەندە، و ڕەچەتەکەی بۆ کیلۆیەکە.",
    },
  "a kilo": { ar: "بالكيلو", ckb: "بە کیلۆ" },
  "a size": { ar: "حجمًا", ckb: "قەبارەیەک" },
  // The audit trail.
  "Sold by weight set": { ar: "تحديد البيع بالوزن", ckb: "فرۆشتن بە کێش دانرا" },
};

export default phrases;
