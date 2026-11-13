import type { PhraseBook } from "./types";

/** Plans, parts and the type of business (0108). */
const phrases: PhraseBook = {
  "A central kitchen is in the Business plan": {
    ar: "المطبخ المركزي ضمن خطة Business",
    ckb: "چێشتخانەی ناوەندی لە پلانی Businessدایە",
  },
  "Choose on or off": { ar: "اختر تشغيل أو إيقاف", ckb: "کارا یان ناکارا هەڵبژێرە" },
  "Choose one of the system's parts": {
    ar: "اختر أحد أجزاء النظام",
    ckb: "یەکێک لە بەشەکانی سیستەمەکە هەڵبژێرە",
  },
  "Choose the plan: Starter, Complete or Business": {
    ar: "اختر الخطة: Starter أو Complete أو Business",
    ckb: "پلانەکە هەڵبژێرە: Starter، Complete یان Business",
  },
  "Choose the type of business: a café, a bakery, a restaurant or a supplier": {
    ar: "اختر نوع العمل: مقهى أو مخبز أو مطعم أو مورّد",
    ckb: "جۆری کارەکە هەڵبژێرە: کافێ، نانەواخانە، چێشتخانە یان دابینکەر",
  },
  "More than one branch or store is in the Business plan": {
    ar: "أكثر من فرع أو مخزن ضمن خطة Business",
    ckb: "زیاتر لە لقێک یان کۆگایەک لە پلانی Businessدایە",
  },
  "Only the owner changes the type of business": {
    ar: "المالك وحده يغيّر نوع العمل",
    ckb: "تەنها خاوەنەکە جۆری کارەکە دەگۆڕێت",
  },
  "Only the owner turns a part of the system on or off": {
    ar: "المالك وحده يشغّل جزءًا من النظام أو يوقفه",
    ckb: "تەنها خاوەنەکە بەشێکی سیستەمەکە کارا یان ناکارا دەکات",
  },
  "That business is not found": { ar: "هذا العمل غير موجود", ckb: "ئەو کارە نەدۆزرایەوە" },
  "That part is not in the {1} plan": {
    ar: "هذا الجزء ليس في خطة {1}",
    ckb: "ئەو بەشە لە پلانی {1}دا نییە",
  },
  "That part is off for this business: {1}": {
    ar: "هذا الجزء متوقف لهذا العمل: {1}",
    ckb: "ئەو بەشە بۆ ئەم کارە ناکارایە: {1}",
  },
  "Businesses and plans": { ar: "الأعمال والخطط", ckb: "کارەکان و پلانەکان" },
  "Every business on the system, its type and its plan. A plan changed here takes effect at once: its parts appear or are hidden, and nothing is lost.":
    {
      ar: "كل عمل على النظام ونوعه وخطته. الخطة التي تُغيَّر هنا تسري فورًا: تظهر أجزاؤها أو تُخفى، ولا يضيع شيء.",
      ckb: "هەموو کارێک لەسەر سیستەمەکە، جۆرەکەی و پلانەکەی. پلانێک کە لێرە بگۆڕدرێت دەستبەجێ کار دەکات: بەشەکانی دەردەکەون یان دەشاردرێنەوە، و هیچ لەدەست ناچێت.",
    },
  "Plan and parts": { ar: "الخطة والأجزاء", ckb: "پلان و بەشەکان" },
  "The {plan} plan": { ar: "خطة {plan}", ckb: "پلانی {plan}" },
  "{n} parts on": { ar: "{n} أجزاء مشغّلة", ckb: "{n} بەش کارایە" },
  Business: { ar: "Business", ckb: "Business" },
  Plan: { ar: "الخطة", ckb: "پلان" },
  "Type of business": { ar: "نوع العمل", ckb: "جۆری کار" },
  practice: { ar: "تدريب", ckb: "ڕاهێنان" },
  "Change the type": { ar: "غيّر النوع", ckb: "جۆرەکە بگۆڕە" },
  "Not in the plan": { ar: "ليس في الخطة", ckb: "لە پلانەکەدا نییە" },
  "One system for every business: a part that is off is not shown, and its work is refused, but every sale, delivery and count still posts to the books. Turned on, a part shows its whole history.":
    {
      ar: "نظام واحد لكل عمل: الجزء المتوقف لا يظهر ويُرفض عمله، لكن كل بيع وتسليم وجرد يُقيَّد في الدفاتر. وعند تشغيله يظهر تاريخه كله.",
      ckb: "یەک سیستەم بۆ هەموو کارێک: بەشێکی ناکارا پیشان نادرێت و کارەکەی ڕەت دەکرێتەوە، بەڵام هەموو فرۆشتن و گەیاندن و ژماردنێک هەر لە دەفتەرەکاندا تۆمار دەکرێت. کە کارا کرا، هەموو مێژووەکەی پیشان دەدات.",
    },
  "The {plan} plan · {type}": { ar: "خطة {plan} · {type}", ckb: "پلانی {plan} · {type}" },
  "Turn on": { ar: "شغّل", ckb: "کارای بکە" },
  "a business": { ar: "عملًا", ckb: "کارێک" },
  Starter: { ar: "Starter", ckb: "Starter" },
  Complete: { ar: "Complete", ckb: "Complete" },
  Café: { ar: "مقهى", ckb: "کافێ" },
  Bakery: { ar: "مخبز", ckb: "نانەواخانە" },
  Restaurant: { ar: "مطعم", ckb: "چێشتخانە" },
  "The till: menu, tables, open bills, offline sales": {
    ar: "الصندوق: القائمة والطاولات والفواتير المفتوحة والبيع دون إنترنت",
    ckb: "سندوق: لیستی خواردن، مێزەکان، پسوولە کراوەکان، فرۆشتن بێ ئینتەرنێت",
  },
  "Recipes and costing, production and use-by": {
    ar: "الوصفات والتكلفة والإنتاج وتاريخ الاستخدام",
    ckb: "ڕەچەتە و تێچوو، بەرهەمهێنان و بەسەرچوون",
  },
  "Purchasing and suppliers": { ar: "المشتريات والموردون", ckb: "کڕین و دابینکەران" },
  "Staff, the clock and payroll": {
    ar: "الموظفون والحضور والرواتب",
    ckb: "کارمەندان، کاتژمێری ئامادەبوون و مووچە",
  },
  "The full accounting screens: journals, the bank, the balance sheet": {
    ar: "شاشات المحاسبة الكاملة: القيود والبنك والميزانية",
    ckb: "شاشە تەواوەکانی ژمێریاری: تۆمارەکان، بانک، باڵانس",
  },
  "Customers on account: invoices, terms and payments": {
    ar: "الزبائن بالحساب: الفواتير والشروط والدفعات",
    ckb: "کڕیارانی سەر حساب: پسوولە، مەرج و پارەدانەکان",
  },
  "Several places: branches, a central kitchen, transfers": {
    ar: "عدة أماكن: فروع ومطبخ مركزي وتحويلات",
    ckb: "چەند شوێنێک: لقەکان، چێشتخانەی ناوەندی، گواستنەوەکان",
  },
  "Plan changed": { ar: "تغيّرت الخطة", ckb: "پلان گۆڕدرا" },
  "A part turned on or off": { ar: "شُغّل جزء أو أُوقف", ckb: "بەشێک کارا یان ناکارا کرا" },
  "Type of business changed": { ar: "تغيّر نوع العمل", ckb: "جۆری کار گۆڕدرا" },
};

export default phrases;
