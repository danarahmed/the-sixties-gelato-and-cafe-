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
  // The receipt sent by WhatsApp, at the till.
  "WhatsApp…": { ar: "واتساب…", ckb: "واتساپ…" },
  "Their WhatsApp number": { ar: "رقم واتسابهم", ckb: "ژمارەی واتساپەکەیان" },
  "Send by WhatsApp": { ar: "أرسل عبر واتساب", ckb: "بە واتساپ بنێرە" },
  // The customer's screen.
  "Welcome!": { ar: "أهلًا وسهلًا!", ckb: "بەخێربێن!" },
  "Thank you!": { ar: "شكرًا لك!", ckb: "سوپاس!" },
  "Paid {amount}": { ar: "المدفوع {amount}", ckb: "دراوە {amount}" },
  "Your change: {amount}": { ar: "الباقي لك: {amount}", ckb: "گەڕاوەکەت: {amount}" },
  "The customer's screen": { ar: "شاشة الزبون", ckb: "شاشەی کڕیار" },
  "A screen turned to the customer: open their screen on it, from this till, and it shows what you ring up and the total.":
    {
      ar: "شاشة موجّهة إلى الزبون: افتح شاشته عليها من هذا الصندوق، فتعرض ما تسجّله والمجموع.",
      ckb: "شاشەیەک ڕووی لە کڕیارە: شاشەکەی لەسەری بکەرەوە لەم خاڵی فرۆشتنەوە، ئەوەی تۆمار دەکەیت و کۆی گشتی پیشان دەدات.",
    },
  // Orders sent from phones (0119).
  "Order {no} is sent": { ar: "أُرسل الطلب {no}", ckb: "داواکاری {no} نێردرا" },
  "The café has taken it.": { ar: "استلم المقهى طلبك.", ckb: "کافێکە وەریگرت." },
  "The café could not take it: {why}": {
    ar: "لم يستطع المقهى أخذه: {why}",
    ckb: "کافێکە نەیتوانی وەریبگرێت: {why}",
  },
  "Waiting for the café to take it…": {
    ar: "بانتظار أن يأخذه المقهى…",
    ckb: "چاوەڕێی ئەوەیە کافێکە وەریبگرێت…",
  },
  "To my table": { ar: "إلى طاولتي", ckb: "بۆ مێزەکەم" },
  "To deliver": { ar: "توصيل", ckb: "گەیاندن" },
  "Or send it to the counter": { ar: "أو أرسله إلى الكاونتر", ckb: "یان بینێرە بۆ کاونتەر" },
  "Your table": { ar: "طاولتك", ckb: "مێزەکەت" },
  "Your name": { ar: "اسمك", ckb: "ناوت" },
  "Your phone number": { ar: "رقم هاتفك", ckb: "ژمارەی مۆبایلەکەت" },
  "Where it goes": { ar: "إلى أين يذهب", ckb: "بۆ کوێ دەچێت" },
  "Send my order": { ar: "أرسل طلبي", ckb: "داواکارییەکەم بنێرە" },
  "You pay at the café, as always.": {
    ar: "تدفع في المقهى كالعادة.",
    ckb: "لە کافێکە پارە دەدەیت، وەک هەمیشە.",
  },
  "Table {name}": { ar: "الطاولة {name}", ckb: "مێزی {name}" },
  "From phones ({n})": { ar: "من الهواتف ({n})", ckb: "لە مۆبایلەکانەوە ({n})" },
  "Why it is turned down": { ar: "لماذا يُرفض", ckb: "بۆچی ڕەتدەکرێتەوە" },
  "Turn it down": { ar: "ارفضه", ckb: "ڕەتی بکەرەوە" },
  "A table may send its order straight to the till": {
    ar: "يمكن للطاولة إرسال طلبها مباشرة إلى الصندوق",
    ckb: "مێز دەتوانێت داواکارییەکەی ڕاستەوخۆ بنێرێت بۆ خاڵی فرۆشتن",
  },
  "Orders to take away or deliver, with a name and a phone number": {
    ar: "طلبات سفري أو توصيل، باسم ورقم هاتف",
    ckb: "داواکاری بۆ بردن یان گەیاندن، بە ناو و ژمارەی مۆبایل",
  },
  "Each waits at the till to be taken or turned down; it is paid at the café, as always.": {
    ar: "كل طلب ينتظر عند الصندوق ليُؤخذ أو يُرفض؛ ويُدفع في المقهى كالعادة.",
    ckb: "هەر یەکێک لە خاڵی فرۆشتن چاوەڕێ دەکات بۆ وەرگرتن یان ڕەتکردنەوە؛ لە کافێکە پارەی دەدرێت، وەک هەمیشە.",
  },
  // From the database (0119).
  "Show your order to the waiter": {
    ar: "أرِ طلبك للنادل",
    ckb: "داواکارییەکەت پیشانی گارسۆن بدە",
  },
  "This café takes no orders from phones": {
    ar: "هذا المقهى لا يأخذ طلبات من الهواتف",
    ckb: "ئەم کافێیە داواکاری لە مۆبایلەوە وەرناگرێت",
  },
  "Say which table you are at": { ar: "قل على أي طاولة أنت", ckb: "بڵێ لەسەر کام مێزیت" },
  "Type your name": { ar: "اكتب اسمك", ckb: "ناوت بنووسە" },
  "Type your phone number": { ar: "اكتب رقم هاتفك", ckb: "ژمارەی مۆبایلەکەت بنووسە" },
  "Type where it goes": { ar: "اكتب إلى أين يذهب", ckb: "بنووسە بۆ کوێ دەچێت" },
  "Too many orders from this phone: ask at the counter": {
    ar: "طلبات كثيرة من هذا الهاتف: اسأل عند الكاونتر",
    ckb: "داواکاری زۆر لەم مۆبایلەوە: لە کاونتەر بپرسە",
  },
  "The café is busy: ask at the counter": {
    ar: "المقهى مشغول: اسأل عند الكاونتر",
    ckb: "کافێکە قەرەباڵغە: لە کاونتەر بپرسە",
  },
  "Choose up to 30 things": { ar: "اختر حتى 30 شيئًا", ckb: "تا 30 شت هەڵبژێرە" },
  "The order cannot be read": { ar: "تعذّرت قراءة الطلب", ckb: "داواکارییەکە ناخوێندرێتەوە" },
  "Something on the order is not on the menu now": {
    ar: "شيء في الطلب ليس في القائمة الآن",
    ckb: "شتێک لە داواکارییەکەدا ئێستا لە لیستەکەدا نییە",
  },
  "That order is not found": { ar: "ذلك الطلب غير موجود", ckb: "ئەو داواکارییە نەدۆزرایەوە" },
  "That order was dealt with already": {
    ar: "تمّ التعامل مع ذلك الطلب",
    ckb: "ئەو داواکارییە پێشتر مامەڵەی لەگەڵ کرا",
  },
  "Say why it is turned down": { ar: "قل لماذا يُرفض", ckb: "بڵێ بۆچی ڕەتدەکرێتەوە" },
  "Turn the menu on customers' phones on first": {
    ar: "شغّل القائمة على هواتف الزبائن أولًا",
    ckb: "سەرەتا لیستی خواردن لەسەر مۆبایلی کڕیاران هەڵبکە",
  },
};

export default phrases;
