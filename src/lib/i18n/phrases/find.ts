import type { PhraseBook } from "./types";

/** Find anything (E4), each person's first screen (E6), photos many at once (E8). */
const phrases: PhraseBook = {
  "Find anything": { ar: "ابحث عن أي شيء", ckb: "هەر شتێک بدۆزەرەوە" },
  Screen: { ar: "شاشة", ckb: "شاشە" },
  "Stock item": { ar: "مادة مخزون", ckb: "کاڵای کۆگا" },
  "Purchase order": { ar: "أمر شراء", ckb: "داواکاری کڕین" },
  "Find the sale on Orders": {
    ar: "ابحث عن البيع في الطلبات",
    ckb: "فرۆشتنەکە لە داواکارییەکان بدۆزەرەوە",
  },
  Found: { ar: "ما وُجد", ckb: "دۆزراوەکان" },
  "A screen, a product, a customer, a sale's number…": {
    ar: "شاشة، منتج، زبون، رقم بيع…",
    ckb: "شاشەیەک، بەرهەمێک، کڕیارێک، ژمارەی فرۆشتنێک…",
  },
  "Nothing found for “{q}”.": {
    ar: "لم يُعثر على شيء لـ «{q}».",
    ckb: "هیچ شتێک بۆ «{q}» نەدۆزرایەوە.",
  },
  "First screen": { ar: "الشاشة الأولى", ckb: "یەکەم شاشە" },
  "Where you start after signing in, on any phone or till.": {
    ar: "حيث تبدأ بعد تسجيل الدخول، على أي هاتف أو صندوق.",
    ckb: "ئەو شوێنەی دوای چوونەژوورەوە لێی دەست پێ دەکەیت، لەسەر هەر مۆبایل یان سندوقێک.",
  },
  "My role's: {screen}": { ar: "شاشة دوري: {screen}", ckb: "هی ڕۆڵەکەم: {screen}" },
  "That screen is not one of yours.": {
    ar: "هذه الشاشة ليست من شاشاتك.",
    ckb: "ئەو شاشەیە یەکێک نییە لە شاشەکانی تۆ.",
  },
  "Saved: you start there from now on.": {
    ar: "حُفظ: ستبدأ من هناك من الآن.",
    ckb: "پاشەکەوت کرا: لە ئێستاوە لەوێوە دەست پێ دەکەیت.",
  },
  "Add many at once": { ar: "أضف عدة صور معًا", ckb: "چەندانێک پێکەوە زیاد بکە" },
  "Name each file as its product: latte.jpg goes on Latte.": {
    ar: "سمِّ كل ملف باسم منتجه، فيذهب إليه.",
    ckb: "هەر فایلێک بە ناوی بەرهەمەکەی ناو بنێ، دەچێتە سەری.",
  },
  "{n} of {total}…": { ar: "{n} من {total}…", ckb: "{n} لە {total}…" },
  "{n} photo(s) saved; {m} not placed.": {
    ar: "الصور المحفوظة: {n}؛ غير الموضوعة: {m}.",
    ckb: "{n} وێنە پاشەکەوت کران؛ {m} دانەنران.",
  },
  "Not placed (give these a photo by hand):": {
    ar: "لم تُوضع (أعطها صورة يدويًا):",
    ckb: "دانەنران (بە دەست وێنەیان بدەرێ):",
  },
  "Show less": { ar: "أظهر أقل", ckb: "کەمتر پیشان بدە" },
  "Show the rest: charts, stock, recent sales": {
    ar: "أظهر الباقي: الرسوم، المخزون، آخر المبيعات",
    ckb: "ئەوانی تر پیشان بدە: هێڵکارییەکان، کۆگا، دوایین فرۆشتنەکان",
  },
};

export default phrases;
