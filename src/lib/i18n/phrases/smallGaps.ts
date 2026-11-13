import type { PhraseBook } from "./types";

/** The books' smaller gaps (0114): a late payment and the drawer's short, a prepaid expense changed. */
const phrases: PhraseBook = {
  "It explains {amount} of the drawer's short on {day}: a cost of that day, and today's drawer is as counted.":
    {
      ar: "يفسّر {amount} من نقص الدرج يوم {day}: تكلفة ذلك اليوم، ودرج اليوم كما عُدّ.",
      ckb: "{amount} لە کەمی دەخلەکە لە {day} ڕوون دەکاتەوە: تێچووی ئەو ڕۆژەیە، و دەخلی ئەمڕۆ وەک ژمێردراوە.",
    },
  "The first month": { ar: "الشهر الأول", ckb: "یەکەم مانگ" },
  "Changed while no share is posted": {
    ar: "يُغيَّر ما دام لم تُرحَّل أي حصة",
    ckb: "دەگۆڕدرێت تا هیچ بەشێک تۆمار نەکرابێت",
  },
  // From the database (0114).
  "A prepaid expense stays as it was recorded once a share is posted: cancel it and record it again":
    {
      ar: "يبقى المصروف المدفوع مقدمًا كما سُجّل بعد ترحيل حصة: ألغه وسجّله من جديد",
      ckb: "خەرجی پێشوەخت دوای تۆمارکردنی بەشێک وەک خۆی دەمێنێتەوە: هەڵیبوەشێنەوە و دووبارە تۆماری بکە",
    },
};

export default phrases;
