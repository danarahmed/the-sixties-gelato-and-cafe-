import type { PhraseBook } from "./types";

/** Social insurance and the payslip (0112), on Payroll. */
const phrases: PhraseBook = {
  "Social insurance": { ar: "الضمان الاجتماعي", ckb: "دڵنیایی کۆمەڵایەتی" },
  "Social insurance is taken from the pay": {
    ar: "يُقتطع الضمان الاجتماعي من الراتب",
    ckb: "دڵنیایی کۆمەڵایەتی لە مووچە دەبڕدرێت",
  },
  "The café's part, %": { ar: "حصة المقهى، %", ckb: "بەشی کافێکە، %" },
  "The person's part, %": { ar: "حصة الموظف، %", ckb: "بەشی کەسەکە، %" },
  "The café's part": { ar: "حصة المقهى", ckb: "بەشی کافێکە" },
  "The people's part": { ar: "حصة الموظفين", ckb: "بەشی کارمەندان" },
  "Saved: the next payroll approved takes it.": {
    ar: "حُفظ: يُطبَّق على كشف الرواتب القادم عند اعتماده.",
    ckb: "پاشەکەوت کرا: لیستی مووچەی داهاتوو کە پەسەند بکرێت پێی دەکات.",
  },
  "Only the owner turns social insurance on or off": {
    ar: "المالك وحده يشغّل الضمان الاجتماعي أو يوقفه",
    ckb: "تەنها خاوەنەکە دڵنیایی کۆمەڵایەتی دادەگیرسێنێت یان دەیکوژێنێتەوە",
  },
  "Approving a payroll takes the person's part from their pay, and owes it with the café's part to the government: the café's part is Dr 6120 Social insurance, both are Cr 2110 Social insurance owed.":
    {
      ar: "اعتماد كشف الرواتب يقتطع حصة الموظف من راتبه، ويُستحق مع حصة المقهى للحكومة: حصة المقهى مدين 6120 الضمان الاجتماعي، والحصتان دائن 2110 الضمان الاجتماعي المستحق.",
      ckb: "پەسەندکردنی لیستی مووچە بەشی کەسەکە لە مووچەکەی دەبڕێت، و لەگەڵ بەشی کافێکە قەرزی حکومەتە: بەشی کافێکە قەرزار 6120 دڵنیایی کۆمەڵایەتی، هەردووکیان بەستانکار 2110 دڵنیایی کۆمەڵایەتی قەرز.",
    },
  "Who it is taken for": { ar: "لمن يُقتطع", ckb: "بۆ کێ دەبڕدرێت" },
  "Untick someone on a trial period: nothing is taken for them until they are ticked.": {
    ar: "أزل العلامة عمّن هو في فترة التجربة: لا يُقتطع له شيء حتى تُعلَّم.",
    ckb: "نیشانەی کەسێک لابەرە کە لە ماوەی تاقیکردنەوەدایە: هیچی بۆ نابڕدرێت تا نیشانە دەکرێت.",
  },
  Owed: { ar: "المستحق", ckb: "قەرز" },
  "The government's receipt no.": { ar: "رقم إيصال الحكومة", ckb: "ژمارەی پسوولەی حکومەت" },
  "Pay the government": { ar: "ادفع للحكومة", ckb: "بە حکومەت بدە" },
  Payslip: { ar: "قسيمة الراتب", ckb: "پسوولەی مووچە" },
  "Social insurance, the person's part": {
    ar: "الضمان الاجتماعي، حصة الموظف",
    ckb: "دڵنیایی کۆمەڵایەتی، بەشی کەسەکە",
  },
  "The café pays {amount} social insurance for them too, on top of the pay.": {
    ar: "يدفع المقهى أيضًا {amount} ضمانًا اجتماعيًا عنه، فوق الراتب.",
    ckb: "کافێکە {amount} دڵنیایی کۆمەڵایەتیش بۆی دەدات، سەرەڕای مووچەکە.",
  },
  // From the database (0112).
  "Each part is from {1}% to {2}% of the salary": {
    ar: "كل حصة من {1}% إلى {2}% من الراتب",
    ckb: "هەر بەشێک لە {1}% تا {2}%ی مووچەیە",
  },
  "{1} is owed for that month: a payment is at most that": {
    ar: "المستحق لذلك الشهر {1}: الدفعة لا تتجاوز ذلك",
    ckb: "{1} قەرزی ئەو مانگەیە: پارەدان زۆرترین ئەوەندەیە",
  },
  "Say where the money came from: the bank or the safe": {
    ar: "حدّد مصدر المال: البنك أو الخزنة",
    ckb: "بڵێ پارەکە لە کوێوە هات: بانک یان قاسە",
  },
  "Each part is from 0% to 50% of the salary": {
    ar: "كل حصة من 0% إلى 50% من الراتب",
    ckb: "هەر بەشێک لە 0% تا 50%ی مووچەیە",
  },
  "Employee not found": { ar: "الموظف غير موجود", ckb: "کارمەندەکە نەدۆزرایەوە" },
  "Payslip not found": { ar: "قسيمة الراتب غير موجودة", ckb: "پسوولەی مووچە نەدۆزرایەوە" },
};

export default phrases;
