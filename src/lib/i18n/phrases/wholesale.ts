import type { PhraseBook } from "./types";

/** The supplier's parts (0111): quotes, delivery notes, credit notes, customer prices, cartons. */
const phrases: PhraseBook = {
  "A credit note needs an amount more than 0": {
    ar: "الإشعار الدائن يحتاج مبلغًا أكبر من 0",
    ckb: "پسوولەی گەڕاوە بڕێکی زیاتر لە ٠ی پێویستە",
  },
  "A pack is from 1 to 1000 of the item": {
    ar: "العبوة من 1 إلى 1000 من الصنف",
    ckb: "پاکێت لە ١ تا ١٠٠٠ لە کاڵاکەیە",
  },
  "A price is 0 or more": { ar: "السعر 0 أو أكثر", ckb: "نرخ ٠ یان زیاترە" },
  "A quote is good until today or later": {
    ar: "العرض صالح حتى اليوم أو بعده",
    ckb: "پێشنیاری نرخ تا ئەمڕۆ یان دواتر دەبێت",
  },
  "Choose out or delivered": { ar: "اختر خرج أو سُلّم", ckb: "دەرچوو یان گەیەنرا هەڵبژێرە" },
  "Choose sent, accepted or cancelled": {
    ar: "اختر أُرسل أو قُبل أو أُلغي",
    ckb: "نێردرا، قبوڵکرا یان هەڵوەشێنرا هەڵبژێرە",
  },
  "Say who signed for it": { ar: "قل من وقّع على الاستلام", ckb: "بڵێ کێ واژۆی وەرگرتنی کرد" },
  "That delivery is done already": {
    ar: "هذا التسليم تمّ بالفعل",
    ckb: "ئەو گەیاندنە پێشتر تەواو بووە",
  },
  "That delivery note is not found": {
    ar: "إشعار التسليم غير موجود",
    ckb: "ئەو پسوولەی گەیاندنە نەدۆزرایەوە",
  },
  "That invoice has a delivery note on its way already": {
    ar: "لهذه الفاتورة إشعار تسليم في الطريق بالفعل",
    ckb: "ئەم پسوولەیە پسوولەیەکی گەیاندنی لە ڕێگادایە",
  },
  "That invoice is not found": { ar: "هذه الفاتورة غير موجودة", ckb: "ئەو پسوولەیە نەدۆزرایەوە" },
  "That quote has run out: make a new one": {
    ar: "انتهت صلاحية هذا العرض: أعدّ عرضًا جديدًا",
    ckb: "ئەو پێشنیارە بەسەرچووە: یەکێکی نوێ دروست بکە",
  },
  "That quote is closed": { ar: "هذا العرض مغلق", ckb: "ئەو پێشنیارە داخراوە" },
  "That quote is not found": { ar: "هذا العرض غير موجود", ckb: "ئەو پێشنیارە نەدۆزرایەوە" },
  "That quote is not open": { ar: "هذا العرض ليس مفتوحًا", ckb: "ئەو پێشنیارە کراوە نییە" },
  "{1} owes {2}: a credit note is at most that": {
    ar: "{1} مدين بـ {2}: الإشعار الدائن لا يتجاوز ذلك",
    ckb: "{1} {2} قەرزارە: پسوولەی گەڕاوە زۆرترین ئەوەندەیە",
  },
  "Quotes for customers on account, invoiced at the prices they gave; delivery notes out with the driver and signed for; credit notes for what came back; each customer's own prices; and a stock item sold as it is, or by the carton.":
    {
      ar: "عروض أسعار للزبائن بالحساب تُفوتر بأسعارها؛ إشعارات تسليم مع السائق وتوقيع الاستلام؛ إشعارات دائنة لما أُرجع؛ سعر كل زبون؛ وصنف مخزون يُباع كما هو أو بالكرتونة.",
      ckb: "پێشنیاری نرخ بۆ کڕیارانی سەر حساب کە بە نرخەکانی خۆیان پسوولە دەکرێن؛ پسوولەی گەیاندن لەگەڵ شۆفێر و واژۆی وەرگرتن؛ پسوولەی گەڕاوە بۆ ئەوەی گەڕایەوە؛ نرخی هەر کڕیارێک؛ و کاڵایەکی کۆگا کە وەک خۆی یان بە کارتۆن دەفرۆشرێت.",
    },
  Wholesale: { ar: "البيع بالجملة", ckb: "فرۆشتنی کۆ" },
  "A credit note": { ar: "إشعار دائن", ckb: "پسوولەیەکی گەڕاوە" },
  "A customer's own price": { ar: "سعر خاص بزبون", ckb: "نرخی تایبەتی کڕیارێک" },
  Accepted: { ar: "مقبول", ckb: "قبوڵکراو" },
  Delivered: { ar: "سُلّم", ckb: "گەیەنرا" },
  "Delivery notes": { ar: "إشعارات التسليم", ckb: "پسوولەکانی گەیاندن" },
  Driver: { ar: "السائق", ckb: "شۆفێر" },
  "Good until": { ar: "صالح حتى", ckb: "دروستە تا" },
  "How many in one (a carton's count)": {
    ar: "كم في الواحدة (عدد الكرتونة)",
    ckb: "چەند لە یەکێکدا (ژمارەی کارتۆنێک)",
  },
  "Invoice it": { ar: "فوتره", ckb: "پسوولەی بکە" },
  "Invoice {n}": { ar: "الفاتورة {n}", ckb: "پسوولەی {n}" },
  "Make the delivery note": { ar: "أعدّ إشعار التسليم", ckb: "پسوولەی گەیاندنەکە دروست بکە" },
  "Make the quote": { ar: "أعدّ العرض", ckb: "پێشنیارەکە دروست بکە" },
  "Name on the menu": { ar: "الاسم في القائمة", ckb: "ناو لە لیستدا" },
  "Out with the driver": { ar: "مع السائق", ckb: "لەگەڵ شۆفێرە" },
  "Put it on the menu": { ar: "ضعه في القائمة", ckb: "بیخە سەر لیست" },
  Quotes: { ar: "عروض الأسعار", ckb: "پێشنیارەکانی نرخ" },
  Route: { ar: "الطريق", ckb: "ڕێگا" },
  "Sell a stock item as it is": { ar: "بِع صنف مخزون كما هو", ckb: "کاڵایەکی کۆگا وەک خۆی بفرۆشە" },
  "Signed by {name}": { ar: "وقّع {name}", ckb: "{name} واژۆی کرد" },
  "Take it off what they owe": { ar: "اخصمه مما يدينون به", ckb: "لە قەرزەکەیان بیبڕە" },
  "Their price": { ar: "سعرهم", ckb: "نرخی ئەوان" },
  "Who signed for it": { ar: "من وقّع على الاستلام", ckb: "کێ واژۆی وەرگرتنی کرد" },
  "Good until must be a date": {
    ar: "«صالح حتى» يجب أن يكون تاريخًا",
    ckb: "«دروستە تا» دەبێت بەروار بێت",
  },
  "a delivery note": { ar: "إشعار تسليم", ckb: "پسوولەیەکی گەیاندن" },
  "a quote": { ar: "عرض أسعار", ckb: "پێشنیارێکی نرخ" },
  "an invoice": { ar: "فاتورة", ckb: "پسوولەیەک" },
  Draft: { ar: "مسودة", ckb: "ڕەشنووس" },
  Invoiced: { ar: "فُوتر", ckb: "پسوولەکرا" },
  Prepared: { ar: "جاهز للإرسال", ckb: "ئامادەکرا" },
  "Price lists for each customer": { ar: "قوائم أسعار لكل زبون", ckb: "لیستی نرخ بۆ هەر کڕیارێک" },
  "Quotes, sales orders and delivery notes": {
    ar: "عروض الأسعار وطلبات البيع وإشعارات التسليم",
    ckb: "پێشنیاری نرخ، داواکاری فرۆشتن و پسوولەی گەیاندن",
  },
  "Customer price set": { ar: "ضُبط سعر زبون", ckb: "نرخی کڕیارێک دانرا" },
  "Quote saved": { ar: "حُفظ العرض", ckb: "پێشنیارەکە پاشەکەوت کرا" },
  "Credit note given": { ar: "أُعطي إشعار دائن", ckb: "پسوولەی گەڕاوە درا" },
  "Delivery note made": { ar: "أُعدّ إشعار تسليم", ckb: "پسوولەی گەیاندن دروست کرا" },
};

export default phrases;
