import type { PhraseBook } from "./types";

/** Meal deals and prices by the time of day (0089): the database's words. */
const phrases: PhraseBook = {
  "A deal on the bill has no key": {
    ar: "عرض في الفاتورة بلا مفتاح",
    ckb: "ئۆفەرێک لە پسوولەکەدا کلیلی نییە",
  },
  "A deal on the bill is mixed with another": {
    ar: "عرض في الفاتورة مختلط بعرض آخر",
    ckb: "ئۆفەرێک لە پسوولەکەدا تێکەڵی یەکێکی تر بووە",
  },
  "That deal is not on now": { ar: "هذا العرض غير متاح الآن", ckb: "ئەو ئۆفەرە ئێستا بەردەست نییە" },
  "That deal is not sold on this channel": {
    ar: "هذا العرض لا يُباع بهذه الطريقة",
    ckb: "ئەو ئۆفەرە بەم شێوەیە نافرۆشرێت",
  },
  "A deal is one of each of the things in it": {
    ar: "العرض واحد من كل شيء فيه",
    ckb: "ئۆفەر یەکێکە لە هەر شتێکی ناوی",
  },
  "Give the hours it runs, from and until": {
    ar: "حدّد الساعات التي يسري فيها، من وإلى",
    ckb: "ئەو کاتژمێرانەی کار دەکات بنووسە، لە و تا",
  },
  "Choose the days it runs": { ar: "اختر الأيام التي يسري فيها", ckb: "ئەو ڕۆژانەی کار دەکات هەڵبژێرە" },
  "A delivery platform sets its own prices": {
    ar: "منصة التوصيل تحدد أسعارها بنفسها",
    ckb: "پلاتفۆرمی گەیاندن نرخەکانی خۆی دادەنێت",
  },
  "That price is not running": { ar: "هذا السعر غير سارٍ", ckb: "ئەو نرخە کار ناکات" },
  "Give the hours it is shown, from and until, or neither": {
    ar: "حدّد ساعات ظهوره، من وإلى، أو لا شيء منهما",
    ckb: "کاتژمێرەکانی پیشاندانی بنووسە، لە و تا، یان هیچیان",
  },
  "Choose the days it is shown": { ar: "اختر أيام ظهوره", ckb: "ڕۆژەکانی پیشاندانی هەڵبژێرە" },
  "A deal sold is kept as it was sold": {
    ar: "العرض المباع يبقى كما بيع",
    ckb: "ئۆفەری فرۆشراو وەک خۆی دەمێنێتەوە",
  },
  "Name the deal": { ar: "سمِّ العرض", ckb: "ناوێک بۆ ئۆفەرەکە دابنێ" },
  "A deal's name is at most 60 letters": {
    ar: "اسم العرض 60 حرفًا على الأكثر",
    ckb: "ناوی ئۆفەر لە 60 پیت زیاتر نییە",
  },
  "There is already a deal called {1}": {
    ar: "يوجد عرض باسم {1} مسبقًا",
    ckb: "ئۆفەرێک بە ناوی {1} هەیە",
  },
  "Give the deal a price": { ar: "ضع سعرًا للعرض", ckb: "نرخێک بۆ ئۆفەرەکە دابنێ" },
  "A deal has at least two things in it": {
    ar: "العرض فيه شيئان على الأقل",
    ckb: "ئۆفەر لانیکەم دوو شتی تێدایە",
  },
  "A deal has at most eight things in it": {
    ar: "العرض فيه ثمانية أشياء على الأكثر",
    ckb: "ئۆفەر زۆرترین هەشت شتی تێدایە",
  },
  "Give the hours it is on, from and until, or neither": {
    ar: "حدّد ساعات سريانه، من وإلى، أو لا شيء منهما",
    ckb: "کاتژمێرەکانی بەردەستبوونی بنووسە، لە و تا، یان هیچیان",
  },
  "Choose the days it is on": { ar: "اختر أيام سريانه", ckb: "ڕۆژەکانی بەردەستبوونی هەڵبژێرە" },
  "Deal not found": { ar: "العرض غير موجود", ckb: "ئۆفەرەکە نەدۆزرایەوە" },
  "Unknown channel {1}": { ar: "طريقة بيع غير معروفة {1}", ckb: "شێوازی فرۆشتنی نەناسراو {1}" },
  "A delivery platform sets its own offers": {
    ar: "منصة التوصيل تحدد عروضها بنفسها",
    ckb: "پلاتفۆرمی گەیاندن ئۆفەرەکانی خۆی دادەنێت",
  },
  "Each thing in a deal is a product or a category with products on sale": {
    ar: "كل شيء في العرض منتج أو فئة فيها منتجات معروضة للبيع",
    ckb: "هەر شتێک لە ئۆفەردا بەرهەمێکە یان پۆلێکە کە بەرهەمی بۆ فرۆشتن تێدایە",
  },
};

export default phrases;
