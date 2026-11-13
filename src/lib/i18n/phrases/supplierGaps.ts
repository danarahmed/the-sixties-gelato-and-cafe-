import type { PhraseBook } from "./types";

/** The supplier's smaller gaps (0115): their refund of a credit; credits and bills as they dated them. */
const phrases: PhraseBook = {
  "They paid it back…": { ar: "أعادوه نقدًا…", ckb: "پارەکەیان گەڕاندەوە…" },
  "Their refund is recorded: {left} of the credit left.": {
    ar: "سُجّل استردادهم: بقي {left} من الإشعار الدائن.",
    ckb: "گەڕاندنەوەکەیان تۆمار کرا: {left} لە پسوولەی گەڕاوە ماوە.",
  },
  "Where the money went": { ar: "أين ذهب المال", ckb: "پارەکە چووە کوێ" },
  "Their receipt or transfer no.": {
    ar: "رقم إيصالهم أو التحويل",
    ckb: "ژمارەی پسوولە یان گواستنەوەکەیان",
  },
  "Record their refund": { ar: "سجّل استردادهم", ckb: "گەڕاندنەوەکەیان تۆمار بکە" },
  "The supplier's date (empty: today)": {
    ar: "تاريخ المورّد (فارغ: اليوم)",
    ckb: "ڕێکەوتی دابینکەر (بەتاڵ: ئەمڕۆ)",
  },
  "Their refund of a credit": { ar: "استردادهم لإشعار دائن", ckb: "گەڕاندنەوەی پسوولەیەکی گەڕاوە" },
  "Their refund of credit {no}": {
    ar: "استردادهم للإشعار الدائن {no}",
    ckb: "گەڕاندنەوەی پسوولەی گەڕاوەی {no}",
  },
  // From the database (0115).
  "Say where the money went: the till, the safe or the bank": {
    ar: "حدّد أين ذهب المال: الصندوق أو الخزنة أو البنك",
    ckb: "بڵێ پارەکە چووە کوێ: خاڵی فرۆشتن، قاسە یان بانک",
  },
  "Credit {1} has {2} left: a refund is at most that": {
    ar: "بقي من الإشعار الدائن {1} مبلغ {2}: الاسترداد لا يتجاوز ذلك",
    ckb: "پسوولەی گەڕاوەی {1} {2}ی ماوە: گەڕاندنەوە زۆرترین ئەوەندەیە",
  },
  "A credit note is dated today or earlier": {
    ar: "يُؤرَّخ الإشعار الدائن اليوم أو قبله",
    ckb: "پسوولەی گەڕاوە بە ئەمڕۆ یان پێشتر ڕێکەوت دەکرێت",
  },
  "A bill is dated today or earlier": {
    ar: "تُؤرَّخ الفاتورة اليوم أو قبله",
    ckb: "پسوولە بە ئەمڕۆ یان پێشتر ڕێکەوت دەکرێت",
  },
  "{1} is in a locked month: date it in an open month": {
    ar: "{1} في شهر مقفل: أرّخه في شهر مفتوح",
    ckb: "{1} لە مانگێکی داخراودایە: لە مانگێکی کراوەدا ڕێکەوتی بکە",
  },
  "A price credit that changes what the stock is worth is dated today": {
    ar: "إشعار السعر الذي يغيّر قيمة المخزون يُؤرَّخ اليوم",
    ckb: "پسوولەی نرخ کە بەهای کۆگا دەگۆڕێت بە ئەمڕۆ ڕێکەوت دەکرێت",
  },
  "Date the credit on or after its bill's day, {1}": {
    ar: "أرّخ الإشعار الدائن في يوم فاتورته {1} أو بعده",
    ckb: "پسوولەی گەڕاوە لە ڕۆژی پسوولەکەی، {1}، یان دواتر ڕێکەوت بکە",
  },
};

export default phrases;
