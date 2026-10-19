import type { PhraseBook } from "./types";

/**
 * Barcodes (round twenty, 0078): a size's barcode, read by the till's
 * scanner, and printed on the café's own labels.
 */
const phrases: PhraseBook = {
  "← Products & Recipes": { ar: "← المنتجات والوصفات", ckb: "← بەرهەم و ڕەچەتەکان" },
  Barcodes: { ar: "الباركودات", ckb: "بارکۆدەکان" },
  "Scan or type the barcode on what is bought in, or make one for the café's own labels. At the till a scan adds it.":
    {
      ar: "امسح أو اكتب الباركود الموجود على ما يُشترى، أو أنشئ واحدًا لملصقات المقهى. في الصندوق يضيفه المسح.",
      ckb: "بارکۆدی سەر ئەوەی دەکڕدرێت سکان بکە یان بینووسە، یان یەکێک بۆ لەیبڵەکانی کافێ دروست بکە. لە سندوق سکانکردن زیادی دەکات.",
    },
  "Barcode of {size}": { ar: "باركود {size}", ckb: "بارکۆدی {size}" },
  "The scale's code": { ar: "رمز الميزان", ckb: "کۆدی تەرازوو" },
  "Make one": { ar: "أنشئ واحدًا", ckb: "یەکێک دروست بکە" },
  "Print labels": { ar: "اطبع الملصقات", ckb: "لەیبڵەکان چاپ بکە" },
  "No size has a barcode yet": {
    ar: "لا يوجد حجم له باركود بعد",
    ckb: "هێشتا هیچ قەبارەیەک بارکۆدی نییە",
  },
  "Give a size its barcode on Products & Recipes, under Sizes & prices.": {
    ar: "أعطِ الحجم باركوده في المنتجات والوصفات، تحت الأحجام والأسعار.",
    ckb: "لە بەرهەم و ڕەچەتەکان، لەژێر قەبارە و نرخەکان، بارکۆد بدە بە قەبارەکە.",
  },
  "How many labels of each, then Print.": {
    ar: "كم ملصقًا من كل واحد، ثم اطبع.",
    ckb: "چەند لەیبڵ لە هەر یەکێک، پاشان چاپ بکە.",
  },
  "Labels of {name}": { ar: "ملصقات {name}", ckb: "لەیبڵەکانی {name}" },
  "Print {n} labels": { ar: "اطبع {n} ملصقًا", ckb: "{n} لەیبڵ چاپ بکە" },
  "No product has the barcode {code}": {
    ar: "لا يوجد منتج بالباركود {code}",
    ckb: "هیچ بەرهەمێک بارکۆدی {code}ی نییە",
  },
  "Barcode set": { ar: "ضُبط الباركود", ckb: "بارکۆد دانرا" },
  Barcode: { ar: "الباركود", ckb: "بارکۆد" },
  "A barcode is 4 to 32 letters and digits": {
    ar: "الباركود من 4 إلى 32 حرفًا ورقمًا",
    ckb: "بارکۆد لە 4 تا 32 پیت و ژمارەیە",
  },
  "That barcode is on {1} already": {
    ar: "هذا الباركود على {1} أصلًا",
    ckb: "ئەو بارکۆدە پێشتر لەسەر {1}ە",
  },
};

export default phrases;
