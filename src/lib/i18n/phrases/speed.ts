import type { PhraseBook } from "./types";

/**
 * Speed (plan 8, 0100): the page for the system's administrators.
 */
const phrases: PhraseBook = {
  Speed: { ar: "السرعة", ckb: "خێرایی" },
  "For the system's administrators:": { ar: "لمديري النظام:", ckb: "بۆ بەڕێوەبەرانی سیستەمەکە:" },
  "How long this device takes to reach the app, the app the database, and each slow screen's call, measured now, from here. Measure from the café, at a busy time and a quiet one, and keep what you measure: it says whether a faster plan or a closer region would help.":
    {
      ar: "كم يستغرق هذا الجهاز للوصول إلى التطبيق، والتطبيق إلى قاعدة البيانات، وكل طلب من الشاشات البطيئة، مقيسًا الآن من هنا. قِس من المقهى، في وقت مزدحم وآخر هادئ، واحفظ ما تقيسه: يبيّن هل تفيد خطة أسرع أو منطقة أقرب.",
      ckb: "ئەم ئامێرە چەند کاتی پێدەچێت بگاتە ئەپەکە، ئەپەکە بگاتە بنکەی زانیارییەکان، و هەر داواکارییەکی شاشە خاوەکان، ئێستا لێرەوە پێوراوە. لە کافێکەوە بیپێوە، لە کاتێکی قەرەباڵغ و کاتێکی ئارام، و ئەوەی دەیپێویت هەڵیبگرە: دەڵێت ئایا پلانێکی خێراتر یان ناوچەیەکی نزیکتر سوودی دەبێت.",
    },
  "Measure now": { ar: "قِس الآن", ckb: "ئێستا بیپێوە" },
  "Measuring…": { ar: "جارٍ القياس…", ckb: "دەپێورێت…" },
  "Not reached": { ar: "لم يُوصَل إليه", ckb: "نەگەیشت" },
  "{n} ms": { ar: "{n} ملّي ثانية", ckb: "{n} میلی چرکە" },
  "This device to the app": { ar: "من هذا الجهاز إلى التطبيق", ckb: "لەم ئامێرەوە بۆ ئەپەکە" },
  "The app to the database": {
    ar: "من التطبيق إلى قاعدة البيانات",
    ckb: "لە ئەپەکەوە بۆ بنکەی زانیارییەکان",
  },
  "The alerts (dashboard)": { ar: "التنبيهات (لوحة المتابعة)", ckb: "ئاگادارکردنەوەکان (داشبۆرد)" },
  "The daily brief (dashboard)": {
    ar: "ملخّص اليوم (لوحة المتابعة)",
    ckb: "پوختەی ڕۆژانە (داشبۆرد)",
  },
  "Today's figures (dashboard)": {
    ar: "أرقام اليوم (لوحة المتابعة)",
    ckb: "ژمارەکانی ئەمڕۆ (داشبۆرد)",
  },
  "The day's sales (Reports)": { ar: "مبيعات اليوم (التقارير)", ckb: "فرۆشی ڕۆژ (ڕاپۆرتەکان)" },
  "The till's menu": { ar: "قائمة شاشة البيع", ckb: "لیستی کاشێر" },
  "The reconciliation (dashboard)": {
    ar: "المطابقة (لوحة المتابعة)",
    ckb: "بەراوردکردن (داشبۆرد)",
  },
  "What it costs to make (Menu)": { ar: "تكلفة التحضير (القائمة)", ckb: "تێچووی دروستکردن (لیست)" },
  "Where and when, and which screens felt slow": {
    ar: "أين ومتى، وأي الشاشات بدت بطيئة",
    ckb: "لە کوێ و کەی، و کام شاشانە خاو بوون",
  },
  "Measurements kept": { ar: "القياسات المحفوظة", ckb: "پێوانە هەڵگیراوەکان" },
  "Nothing kept yet.": { ar: "لم يُحفظ شيء بعد.", ckb: "هێشتا هیچ هەڵنەگیراوە." },
  "Copy, to send": { ar: "انسخ، لترسله", ckb: "لەبەری بگرەوە، بۆ ناردن" },
  "Only the system's administrators see this": {
    ar: "لا يرى هذا إلا مديرو النظام",
    ckb: "تەنها بەڕێوەبەرانی سیستەمەکە ئەمە دەبینن",
  },
  "The measurement cannot be read": { ar: "تعذّرت قراءة القياس", ckb: "پێوانەکە ناخوێندرێتەوە" },
};

export default phrases;
