import type { PhraseBook } from "./types";

/**
 * A supplier bill in dollars and dinars (0103): its dollar part and rate,
 * paying the dollars in dollars or in dinars at a rate, and valuing what is
 * still owed in dollars again at month end.
 */
const phrases: PhraseBook = {
  "Of it, in dollars ($)": { ar: "منها بالدولار ($)", ckb: "لەوە، بە دۆلار ($)" },
  "{dinars} + ${usd}": { ar: "{dinars} + ${usd}", ckb: "{dinars} + ${usd}" },
  "What is paid": { ar: "ما يُدفع", ckb: "ئەوەی دەدرێت" },
  "The dinars owed": { ar: "الدنانير المستحقة", ckb: "دینارە قەرزەکان" },
  "The dollars owed, in dollars": {
    ar: "الدولارات المستحقة، بالدولار",
    ckb: "دۆلارە قەرزەکان، بە دۆلار",
  },
  "The dollars owed, in dinars at a rate": {
    ar: "الدولارات المستحقة، بالدنانير بسعر صرف",
    ckb: "دۆلارە قەرزەکان، بە دینار بە نرخێک",
  },
  "Dollars ($)": { ar: "دولارات ($)", ckb: "دۆلار ($)" },
  "The dollars": { ar: "الدولارات", ckb: "دۆلارەکان" },
  "The dollar's rate": { ar: "سعر الدولار", ckb: "نرخی دۆلار" },
  "Owed to suppliers in dollars: ${usd}, carried at {value}": {
    ar: "المستحق للموردين بالدولار: ${usd}، مقيّد بـ {value}",
    ckb: "قەرزی دابینکەران بە دۆلار: ${usd}، تۆمارکراو بە {value}",
  },
  "Last valued again at {rate} dinars a dollar.": {
    ar: "آخر إعادة تقييم بسعر {rate} دينار للدولار.",
    ckb: "دوایین هەڵسەنگاندنەوە بە {rate} دینار بۆ هەر دۆلارێک.",
  },
  "Value again at month end": {
    ar: "أعد التقييم في نهاية الشهر",
    ckb: "لە کۆتایی مانگدا دووبارە هەڵیبسەنگێنە",
  },
  "Valued again: {n} bills, a difference of {amount} to 6950 Exchange differences.": {
    ar: "أُعيد التقييم: {n} فواتير، وفرق {amount} إلى 6950 فروق الصرف.",
    ckb: "دووبارە هەڵسەنگێندرا: {n} پسوولە، جیاوازی {amount} بۆ ٦٩٥٠ جیاوازییەکانی ئاڵوگۆڕ.",
  },

  // As the database writes them.
  "Payments of ${1} would exceed the ${2} owed in dollars": {
    ar: "مدفوعات بقيمة ${1} ستتجاوز ${2} المستحقة بالدولار",
    ckb: "پارەدانی ${1} لە ${2}ی قەرزی دۆلار زیاتر دەبێت",
  },
  "Type the dollar's rate, in dinars": {
    ar: "اكتب سعر الدولار، بالدينار",
    ckb: "نرخی دۆلار بنووسە، بە دینار",
  },
  "That is {1} dinars a dollar: check the rate": {
    ar: "هذا {1} دينار للدولار: تحقق من السعر",
    ckb: "ئەوە {1} دینارە بۆ هەر دۆلارێک: نرخەکە بپشکنە",
  },
  "Enter the dollars owed, in dollars and cents": {
    ar: "أدخل الدولارات المستحقة، بالدولار والسنت",
    ckb: "دۆلارە قەرزەکان بنووسە، بە دۆلار و سەنت",
  },
  "Enter the dinars owed, or none": {
    ar: "أدخل الدنانير المستحقة، أو لا شيء",
    ckb: "دینارە قەرزەکان بنووسە، یان هیچ",
  },
  "That is more than the {1} owed in dinars on this bill: pay its ${2} in dollars, or in dinars at a rate":
    {
      ar: "هذا أكثر من {1} المستحقة بالدينار على هذه الفاتورة: ادفع ${2} منها بالدولار، أو بالدينار بسعر صرف",
      ckb: "ئەمە زیاترە لە {1}ی قەرزی دینار لەسەر ئەم پسوولەیە: ${2}ەکەی بە دۆلار بدە، یان بە دینار بە نرخێک",
    },
  "Enter the dollars paid, in dollars and cents": {
    ar: "أدخل الدولارات المدفوعة، بالدولار والسنت",
    ckb: "دۆلارە دراوەکان بنووسە، بە دۆلار و سەنت",
  },
  "Nothing is owed in dollars on this bill": {
    ar: "لا شيء مستحق بالدولار على هذه الفاتورة",
    ckb: "هیچ قەرزێکی دۆلار لەسەر ئەم پسوولەیە نییە",
  },
  "That is more than the ${1} owed in dollars on this bill": {
    ar: "هذا أكثر من ${1} المستحقة بالدولار على هذه الفاتورة",
    ckb: "ئەمە زیاترە لە ${1}ی قەرزی دۆلار لەسەر ئەم پسوولەیە",
  },
  "Dollars are paid from the till or the safe: from the bank, pay them in dinars at the rate": {
    ar: "تُدفع الدولارات من الصندوق أو الخزنة: من المصرف، ادفعها بالدينار بالسعر",
    ckb: "دۆلار لە کاشێر یان سەندووقەوە دەدرێت: لە بانکەوە، بە دینار بە نرخەکە بیدە",
  },
  "Dollars are handed over in whole dollars": {
    ar: "تُسلَّم الدولارات دولارات كاملة",
    ckb: "دۆلار بە دۆلاری تەواو دەدرێت",
  },
  "Pay it in dollars or in dinars": {
    ar: "ادفعها بالدولار أو بالدينار",
    ckb: "بە دۆلار یان بە دینار بیدە",
  },
};

export default phrases;
