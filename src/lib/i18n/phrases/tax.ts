import type { PhraseBook } from "./types";

/**
 * The books' blockers, first part (0102): other assets and debts the owner
 * adds, and tax, built in and off until the café turns it on.
 */
const phrases: PhraseBook = {
  // Other assets and debts.
  "An account added here is an income, a cost, a bank, a loan, a kind of equipment, another asset or another debt":
    {
      ar: "الحساب المضاف هنا دخل أو تكلفة أو مصرف أو قرض أو نوع من المعدات أو أصل آخر أو دين آخر",
      ckb: "هەژمارێک کە لێرە زیاد دەکرێت داهاتە، تێچووە، بانکە، قەرزە، جۆرێکی ئامێرە، سەرمایەیەکی ترە یان قەرزێکی ترە",
    },
  "Another asset's code is from 1700 to 1799": {
    ar: "رمز الأصل الآخر من 1700 إلى 1799",
    ckb: "کۆدی سەرمایەیەکی تر لە ١٧٠٠ تا ١٧٩٩ە",
  },
  "Another debt's code is from 2500 to 2599": {
    ar: "رمز الدين الآخر من 2500 إلى 2599",
    ckb: "کۆدی قەرزێکی تر لە ٢٥٠٠ تا ٢٥٩٩ە",
  },
  "Another asset": { ar: "أصل آخر", ckb: "سەرمایەیەکی تر" },
  "Another asset's code is from 1700 to 1799: a deposit paid, a loan given.": {
    ar: "رمز الأصل الآخر من 1700 إلى 1799: تأمين مدفوع، قرض ممنوح.",
    ckb: "کۆدی سەرمایەیەکی تر لە ١٧٠٠ تا ١٧٩٩ە: بارمتەیەکی دراو، قەرزێکی دراو.",
  },
  "Another debt's code is from 2500 to 2599: owed to a partner, a tax owed later.": {
    ar: "رمز الدين الآخر من 2500 إلى 2599: مستحق لشريك، ضريبة مستحقة لاحقًا.",
    ckb: "کۆدی قەرزێکی تر لە ٢٥٠٠ تا ٢٥٩٩ە: قەرزی هاوبەشێک، باجێکی دواتر.",
  },
  "Another debt": { ar: "دين آخر", ckb: "قەرزێکی تر" },

  // Tax, built in and off.
  "Only the owner turns tax on or off": {
    ar: "لا يشغّل الضريبة أو يوقفها إلا المالك",
    ckb: "تەنها خاوەن باج دەکاتەوە یان دەیکوژێنێتەوە",
  },
  "Choose the kind of tax": { ar: "اختر نوع الضريبة", ckb: "جۆری باج هەڵبژێرە" },
  "A tax rate is from {1}% to {2}%": {
    ar: "نسبة الضريبة من {1}% إلى {2}%",
    ckb: "ڕێژەی باج لە {1}% تا {2}%ە",
  },
  "Tax turned on needs its rate": {
    ar: "الضريبة المشغّلة تحتاج نسبتها",
    ckb: "باجی کراوە پێویستی بە ڕێژەکەی هەیە",
  },
  "Say why, in a few words": { ar: "قل السبب، بكلمات قليلة", ckb: "هۆکارەکە بڵێ، بە چەند وشەیەک" },
  "Choose the days, from and to": { ar: "اختر الأيام، من وإلى", ckb: "ڕۆژەکان هەڵبژێرە، لە و تا" },
  Tax: { ar: "الضريبة", ckb: "باج" },
  "Tax is off": { ar: "الضريبة متوقفة", ckb: "باج کوژاوەتەوە" },
  "Tax is on": { ar: "الضريبة تعمل", ckb: "باج کراوەیە" },
  VAT: { ar: "ضريبة القيمة المضافة", ckb: "باجی بەهای زیادکراو" },
  "Sales tax": { ar: "ضريبة المبيعات", ckb: "باجی فرۆشتن" },
  "Rate (%)": { ar: "النسبة (%)", ckb: "ڕێژە (%)" },
  "Turn tax on": { ar: "شغّل الضريبة", ckb: "باج بکەرەوە" },
  "Keep it off": { ar: "أبقها متوقفة", ckb: "کوژاوە بیهێڵەرەوە" },
  "Tax owed on sales": { ar: "الضريبة المستحقة على المبيعات", ckb: "باجی قەرزدار لەسەر فرۆشتن" },
  "Off until the café is asked for it. Turned on, the tax part of what each sale takes in (prices include it) is owed on 2600, not income; a refund gives it back. From then on only.":
    {
      ar: "متوقفة حتى يُطلب من المقهى. وعند تشغيلها يصبح جزء الضريبة مما يأخذه كل بيع (والأسعار تشملها) مستحقًا على 2600 لا دخلًا؛ والاسترداد يعيده. من حينها فقط.",
      ckb: "کوژاوەیە تا لە کافێکە داوا دەکرێت. کە کرایەوە، بەشی باج لەوەی هەر فرۆشتنێک وەریدەگرێت (نرخەکان باجەکەیان تێدایە) لەسەر ٢٦٠٠ قەرزە، نەک داهات؛ گەڕاندنەوەی پارە دەیگەڕێنێتەوە. تەنها لەو کاتەوە.",
    },
  Collected: { ar: "المحصّل", ckb: "کۆکراوە" },
  "Paid to the government": { ar: "المدفوع للحكومة", ckb: "دراوە بە حکومەت" },
  "Owed now": { ar: "المستحق الآن", ckb: "ئێستا قەرزە" },
};

export default phrases;
