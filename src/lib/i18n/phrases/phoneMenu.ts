import type { PhraseBook } from "./types";

/** The menu on customers' phones (0118): the phone's screens, and Settings. */
const phrases: PhraseBook = {
  "Your order": { ar: "طلبك", ckb: "داواکارییەکەت" },
  "Show this to the waiter: they scan it, and bring what you chose.": {
    ar: "أرِ هذا للنادل: يمسحه ويحضر ما اخترت.",
    ckb: "ئەمە پیشانی گارسۆن بدە: سکانی دەکات و ئەوەی هەڵتبژاردووە دەیهێنێت.",
  },
  "Your order, for the waiter to scan": {
    ar: "طلبك، ليمسحه النادل",
    ckb: "داواکارییەکەت، بۆ ئەوەی گارسۆن سکانی بکات",
  },
  "Total {amount}": { ar: "المجموع {amount}", ckb: "کۆی گشتی {amount}" },
  "Change my order": { ar: "غيّر طلبي", ckb: "داواکارییەکەم بگۆڕە" },
  "One less": { ar: "واحد أقل", ckb: "یەکێک کەمتر" },
  "One more of {name}": { ar: "واحد آخر من {name}", ckb: "یەکێکی تر لە {name}" },
  "Nothing is on the menu just now.": {
    ar: "لا شيء في القائمة الآن.",
    ckb: "ئێستا هیچ لە لیستی خواردنەکەدا نییە.",
  },
  "{n} chosen · {amount}": { ar: "{n} مختارة · {amount}", ckb: "{n} هەڵبژێردراو · {amount}" },
  "Show my order to the waiter": { ar: "أرِ طلبي للنادل", ckb: "داواکارییەکەم پیشانی گارسۆن بدە" },
  "This menu is not available": { ar: "هذه القائمة غير متاحة", ckb: "ئەم لیستە بەردەست نییە" },
  "The menu on customers' phones": {
    ar: "القائمة على هواتف الزبائن",
    ckb: "لیستی خواردن لەسەر مۆبایلی کڕیاران",
  },
  "Customers scan the QR on the table: the menu opens on their phone, with the photos and prices, in their language. They choose, and show the waiter their order as a QR; the waiter scans it at the till, and it is added to the bill. Nothing reaches the books from their phone.":
    {
      ar: "يمسح الزبائن رمز QR على الطاولة: تفتح القائمة على هواتفهم بالصور والأسعار وبلغتهم. يختارون ويُرون النادل طلبهم كرمز QR؛ يمسحه النادل عند الصندوق فيُضاف إلى الفاتورة. لا يصل شيء إلى الدفاتر من هواتفهم.",
      ckb: "کڕیاران QRـی سەر مێزەکە سکان دەکەن: لیستی خواردن لەسەر مۆبایلەکەیان دەکرێتەوە، بە وێنە و نرخ، بە زمانی خۆیان. هەڵدەبژێرن و داواکارییەکەیان وەک QR پیشانی گارسۆن دەدەن؛ گارسۆن لە خاڵی فرۆشتن سکانی دەکات و دەخرێتە سەر پسوولەکە. هیچ لە مۆبایلەکەیانەوە ناگاتە دەفتەرەکان.",
    },
  "Its prices are this place's": {
    ar: "أسعارها أسعار هذا المكان",
    ckb: "نرخەکانی نرخی ئەم شوێنەن",
  },
  "A new link": { ar: "رابط جديد", ckb: "بەستەرێکی نوێ" },
  "A new link: print its QR again, the old one opens nothing.": {
    ar: "رابط جديد: اطبع رمزه مرة أخرى، والقديم لا يفتح شيئًا.",
    ckb: "بەستەرێکی نوێ: QRـەکەی دووبارە چاپ بکە، کۆنەکە هیچ ناکاتەوە.",
  },
  "On: the QR opens the menu.": {
    ar: "مُفعّل: الرمز يفتح القائمة.",
    ckb: "هەڵکراو: QRـەکە لیستەکە دەکاتەوە.",
  },
  "Off: the QR opens nothing.": {
    ar: "متوقف: الرمز لا يفتح شيئًا.",
    ckb: "کوژاوە: QRـەکە هیچ ناکاتەوە.",
  },
  "The menu's QR, for the tables": { ar: "رمز القائمة، للطاولات", ckb: "QRـی لیستەکە، بۆ مێزەکان" },
  "Only the owner turns the menu on customers' phones on or off": {
    ar: "المالك وحده يشغّل القائمة على هواتف الزبائن أو يوقفها",
    ckb: "تەنها خاوەنەکە لیستی خواردن لەسەر مۆبایلی کڕیاران هەڵدەکات یان دەیکوژێنێتەوە",
  },
};

export default phrases;
