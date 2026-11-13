import type { PhraseBook } from "./types";

/** Budgets and comparisons (0117): Reports → Compare. */
const phrases: PhraseBook = {
  "Against last year and the budget": {
    ar: "مقارنةً بالعام الماضي والميزانية",
    ckb: "بەراورد بە ساڵی پێشوو و بودجە",
  },
  "Each revenue and cost account in the dates, beside the same days a year before and beside the budget of the dates (each month's budget shared by the days of it the dates cover).":
    {
      ar: "كل حساب إيراد وتكلفة في التواريخ، بجانب الأيام نفسها قبل عام وبجانب ميزانية التواريخ (ميزانية كل شهر موزعة على أيامه التي تشملها التواريخ).",
      ckb: "هەر هەژمارێکی داهات و تێچوو لە ماوەکەدا، لە تەنیشت هەمان ڕۆژەکانی ساڵێک پێش و لە تەنیشت بودجەی ماوەکە (بودجەی هەر مانگێک بەسەر ئەو ڕۆژانەیدا دابەش دەکرێت کە ماوەکە دەیانگرێتەوە).",
    },
  Budget: { ar: "الميزانية", ckb: "بودجە" },
  Revenue: { ar: "الإيرادات", ckb: "داهات" },
  "Gross profit": { ar: "إجمالي الربح", ckb: "قازانجی گشتی" },
  "These dates": { ar: "هذه التواريخ", ckb: "ئەم ماوەیە" },
  "A year before": { ar: "قبل عام", ckb: "ساڵێک پێش" },
  "a year before": { ar: "قبل عام", ckb: "ساڵێک پێش" },
  "the budget": { ar: "الميزانية", ckb: "بودجەکە" },
  "Against the budget": { ar: "مقارنةً بالميزانية", ckb: "بەراورد بە بودجە" },
  "Nothing to compare with": { ar: "لا شيء للمقارنة", ckb: "هیچ نییە بۆ بەراورد" },
  "About as {what}": { ar: "تقريبًا مثل {what}", ckb: "نزیکەی وەک {what}" },
  "{pct}% more than {what}": { ar: "{pct}% أكثر من {what}", ckb: "{pct}% زیاتر لە {what}" },
  "{pct}% less than {what}": { ar: "{pct}% أقل من {what}", ckb: "{pct}% کەمتر لە {what}" },
  "This month's budget": { ar: "ميزانية هذا الشهر", ckb: "بودجەی ئەم مانگە" },
  "Start from last month's figures": {
    ar: "ابدأ من أرقام الشهر الماضي",
    ckb: "لە ژمارەکانی مانگی پێشوو دەست پێ بکە",
  },
  "Budget for {account}": { ar: "ميزانية {account}", ckb: "بودجەی {account}" },
  "Save the budget": { ar: "احفظ الميزانية", ckb: "بودجەکە پاشەکەوت بکە" },
  "Saved: the budget of {month}.": {
    ar: "حُفظت ميزانية {month}.",
    ckb: "بودجەی {month} پاشەکەوت کرا.",
  },
  "Against last year and the budget: each account, and the month's budget →": {
    ar: "مقارنةً بالعام الماضي والميزانية: كل حساب، وميزانية الشهر ←",
    ckb: "بەراورد بە ساڵی پێشوو و بودجە: هەر هەژمارێک، و بودجەی مانگەکە ←",
  },
  // From the database (0117).
  "The owner or the accountant sets the budget": {
    ar: "المالك أو المحاسب يحدد الميزانية",
    ckb: "خاوەن یان ژمێریار بودجە دیاری دەکات",
  },
  "Account {1} is not a revenue or a cost": {
    ar: "الحساب {1} ليس إيرادًا ولا تكلفة",
    ckb: "هەژماری {1} نە داهاتە نە تێچوو",
  },
  "A budget is 0 or more": { ar: "الميزانية 0 أو أكثر", ckb: "بودجە 0 یان زیاترە" },
  "The budget cannot be read": { ar: "تعذّرت قراءة الميزانية", ckb: "بودجەکە ناخوێندرێتەوە" },
};

export default phrases;
