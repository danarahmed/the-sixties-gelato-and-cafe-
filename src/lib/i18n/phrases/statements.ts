import type { PhraseBook } from "./types";

/**
 * The balance sheet and the cash-flow statement (0052, release Z): Reports →
 * Balance sheet and cash flow.
 */
const phrases: PhraseBook = {
  // Reports: the page
  "Balance sheet and cash flow →": {
    ar: "الميزانية العمومية والتدفق النقدي ←",
    ckb: "خشتەی باڵانس و ڕەوتی پارەی نەختینە ←",
  },
  "Balance sheet and cash flow": {
    ar: "الميزانية العمومية والتدفق النقدي",
    ckb: "خشتەی باڵانس و ڕەوتی پارەی نەختینە",
  },
  "What the café owned and owed when the day before the dates ended and when they ended, and where its cash came from and went in between: from the published journals, as the trial balance has them.":
    {
      ar: "ما كان المقهى يملكه وما كان عليه عند انتهاء اليوم السابق للتواريخ وعند انتهائها، ومن أين جاء نقده وإلى أين ذهب بينهما: من القيود المُرحَّلة، كما يُظهرها ميزان المراجعة.",
      ckb: "ئەوەی کافێکە هەیبوو و قەرزاری بوو کاتێک ڕۆژی پێش بەروارەکان کۆتایی هات و کاتێک بەروارەکان کۆتاییان هات، و پارەی نەختینەکەی لە کوێوە هات و بۆ کوێ چوو لە نێوانیاندا: لە تۆمارە پەسەندکراوەکانەوە، وەک تەرازووی پێداچوونەوە هەیەتی.",
    },

  // The balance sheet
  "Balance sheet": { ar: "الميزانية العمومية", ckb: "خشتەی باڵانس" },
  "Each account's balance from the published journals when the day ended. Revenue and expenses not yet closed into Retained earnings (on locking December) are the owner's profit.":
    {
      ar: "رصيد كل حساب من القيود المُرحَّلة عند انتهاء اليوم. الإيرادات والمصروفات التي لم تُقفل بعد في الأرباح المحتجزة (عند قفل كانون الأول) هي ربح المالك.",
      ckb: "باڵانسی هەر هەژمارێک لە تۆمارە پەسەندکراوەکانەوە کاتێک ڕۆژەکە کۆتایی هات. داهات و خەرجییەکان کە هێشتا نەخراونەتە ناو قازانجی هەڵگیراوەوە (بە داخستنی کانوونی یەکەم) قازانجی خاوەنن.",
    },
  "End of {day}": { ar: "نهاية {day}", ckb: "کۆتایی {day}" },
  "What the café owns": { ar: "ما يملكه المقهى", ckb: "ئەوەی کافێکە هەیەتی" },
  "Cash in hand and at the bank": {
    ar: "النقد في اليد وفي البنك",
    ckb: "پارەی نەختینە لە دەست و لە بانک",
  },
  "Current assets": { ar: "الأصول المتداولة", ckb: "سامانی خولاو" },
  "Fixed assets": { ar: "الأصول الثابتة", ckb: "سامانی جێگیر" },
  "Total assets": { ar: "مجموع الأصول", ckb: "کۆی سامان" },
  "What the café owes": { ar: "ما على المقهى", ckb: "ئەوەی کافێکە قەرزارییەتی" },
  "Total owed": { ar: "مجموع ما على المقهى", ckb: "کۆی قەرز" },
  "The owner's": { ar: "ما للمالك", ckb: "بەشی خاوەن" },
  "Profit of earlier years, not yet closed": {
    ar: "أرباح سنوات سابقة لم تُقفل بعد",
    ckb: "قازانجی ساڵانی پێشوو، هێشتا دانەخراوە",
  },
  "Profit this year, not yet closed": {
    ar: "ربح هذه السنة، لم يُقفل بعد",
    ckb: "قازانجی ئەمساڵ، هێشتا دانەخراوە",
  },
  "Total equity": { ar: "مجموع حقوق الملكية", ckb: "کۆی سەرمایە" },
  "Owed and the owner's": { ar: "ما على المقهى وما للمالك", ckb: "قەرز و بەشی خاوەن" },
  "It balances": { ar: "متوازنة", ckb: "هاوسەنگە" },

  // The cash flow
  "Cash flow": { ar: "التدفق النقدي", ckb: "ڕەوتی پارەی نەختینە" },
  "Where the cash in the till, the safe and the bank came from and went, read from what else each journal that moved it touched. Money moved between the till, the safe and the bank is no flow; a bill paid counts as what it was for.":
    {
      ar: "من أين جاء النقد في الدرج والخزنة والبنك وإلى أين ذهب، مقروءاً مما مسّه كل قيد حرّكه. المال المنقول بين الدرج والخزنة والبنك ليس تدفقاً؛ والفاتورة المدفوعة تُحسب بما كانت له.",
      ckb: "پارەی نەختینەی ناو دەخیلە و قاسە و بانک لە کوێوە هات و بۆ کوێ چوو، لەو شتانەوە خوێندراوەتەوە کە هەر تۆمارێک کە جووڵاندی دەستی لێدا. پارەی گوازراوە لە نێوان دەخیلە و قاسە و بانکدا ڕەوت نییە؛ پسووڵەیەکی دراو وەک ئەوەی بۆی بوو دەژمێردرێت.",
    },
  // "Came in" is the stock screens' (ما دخل).
  "Went out": { ar: "ما خرج", ckb: "چووە دەرەوە" },
  "Cash at the start": { ar: "النقد في البداية", ckb: "پارەی نەختینە لە سەرەتادا" },
  "Cash at the end": { ar: "النقد في النهاية", ckb: "پارەی نەختینە لە کۆتاییدا" },
  "Nothing moved the cash in these dates.": {
    ar: "لم يتحرك النقد في هذه التواريخ.",
    ckb: "لەم بەروارانەدا پارەی نەختینە نەجووڵا.",
  },
  "Net change in cash": { ar: "صافي التغير في النقد", ckb: "گۆڕانی پوختی پارەی نەختینە" },
  "It adds up: the cash at the start and at the end are the balance sheet's.": {
    ar: "المجموع صحيح: النقد في البداية وفي النهاية هو ما في الميزانية العمومية.",
    ckb: "کۆکەی ڕاستە: پارەی نەختینە لە سەرەتا و لە کۆتاییدا هی خشتەی باڵانسە.",
  },

  // Its sections and lines
  "From running the café": { ar: "من تشغيل المقهى", ckb: "لە بەڕێوەبردنی کافێکەوە" },
  "Invested in equipment": { ar: "المستثمر في المعدات", ckb: "وەبەرهێنان لە ئامێرەکان" },
  "From and to the owner": { ar: "من المالك وإليه", ckb: "لە خاوەنەوە و بۆ خاوەن" },
  "From changing dollars": { ar: "من صرف الدولارات", ckb: "لە گۆڕینەوەی دۆلارەوە" },
  "Received from sales": { ar: "المقبوض من المبيعات", ckb: "وەرگیراو لە فرۆشتن" },
  "Paid for stock and to suppliers": {
    ar: "المدفوع للمخزون وللموردين",
    ckb: "دراو بۆ کۆگا و بۆ دابینکەران",
  },
  "Paid to staff, and advances": {
    ar: "المدفوع للموظفين، والسلف",
    ckb: "دراو بە کارمەندان، و پێشەکییەکان",
  },
  "Running costs": { ar: "تكاليف التشغيل", ckb: "تێچووی بەڕێوەبردن" },
  "The drawer counted over or short": {
    ar: "زيادة أو عجز عدّ الدرج",
    ckb: "زیادە یان کەمی ژماردنی دەخیلە",
  },
  "Equipment bought or sold": { ar: "معدات اشتُريت أو بيعت", ckb: "ئامێری کڕدراو یان فرۆشراو" },
  "The owner's money in and out": {
    ar: "أموال المالك الداخلة والخارجة",
    ckb: "پارەی خاوەن کە هاتە ژوورەوە و چووە دەرەوە",
  },
  "Dollars changed at another rate than they were kept at": {
    ar: "دولارات صُرفت بسعر غير الذي حُفظت به",
    ckb: "دۆلار کە بە نرخێکی جیاواز لەوەی پێی هەڵگیرابوو گۆڕدرایەوە",
  },
};

export default phrases;
