import type { PhraseBook } from "./types";

/**
 * The café's places (release AB): where a device does its stock work, the
 * stock sent from one place to another, the till at each branch and where
 * each person works.
 */
const phrases: PhraseBook = {
  // Where this device does its stock work, on the stock screens.
  "Stock at": { ar: "المخزون في", ckb: "کۆگا لە" },
  Place: { ar: "المكان", ckb: "شوێن" },
  "<transfers>Transfers</transfers> send stock from one of the café's places to another.": {
    ar: "<transfers>التحويلات</transfers> ترسل المخزون من أحد أماكن المقهى إلى مكان آخر.",
    ckb: "<transfers>گواستنەوەکان</transfers> کۆگا لە شوێنێکی کافێکەوە بۆ شوێنێکی تر دەنێرن.",
  },

  // The transfers' screen.
  Transfers: { ar: "التحويلات", ckb: "گواستنەوەکان" },
  "On its way: {value}": { ar: "في الطريق: {value}", ckb: "لە ڕێگادا: {value}" },
  "Stock sent from one of the café's places to another leaves at its cost where it was, into <b>1210 Stock in transit</b>, and comes into the other place when it is received there; what did not arrive goes to <b>5300 Waste & spoilage</b>. A batch keeps its use-by at the place it goes to.":
    {
      ar: "المخزون المُرسل من أحد أماكن المقهى إلى آخر يخرج بكلفته حيث كان، إلى <b>1210 مخزون في الطريق</b>، ويدخل المكان الآخر حين يُستلم هناك؛ وما لم يصل يذهب إلى <b>5300 الهدر والتلف</b>. وتحتفظ الدفعة بموعد استعمالها في المكان الذي تذهب إليه.",
      ckb: "ئەو کۆگایەی لە شوێنێکی کافێکەوە بۆ شوێنێکی تر دەنێردرێت بە تێچووی خۆی لەو شوێنەی لێی بوو دەردەچێت، بۆ <b>1210 کۆگای لە ڕێگادا</b>، و کاتێک لەوێ وەردەگیرێت دەچێتە ناو شوێنەکەی ترەوە؛ ئەوەی نەگەیشت دەچێتە سەر <b>5300 بەفیڕۆچوون و خراپبوون</b>. هەر دەستەیەک کاتی بەکارهێنانی خۆی لەو شوێنەی بۆی دەچێت دەپارێزێت.",
    },
  "The café has one place": { ar: "للمقهى مكان واحد", ckb: "کافێکە یەک شوێنی هەیە" },
  "Stock is sent between places once the café has a second one: a branch or the central kitchen.": {
    ar: "يُرسل المخزون بين الأماكن حين يصبح للمقهى مكان ثانٍ: فرع أو المطبخ المركزي.",
    ckb: "کاتێک کافێکە شوێنی دووەمی هەبێت، کۆگا لە نێوان شوێنەکاندا دەنێردرێت: لقێک یان چێشتخانەی ناوەندی.",
  },
  "On their way": { ar: "في الطريق", ckb: "لە ڕێگادان" },
  "Nothing is on its way.": { ar: "لا شيء في الطريق.", ckb: "هیچ شتێک لە ڕێگادا نییە." },
  "Received and cancelled": { ar: "المستلمة والملغاة", ckb: "وەرگیراو و هەڵوەشێنراوەکان" },
  "On its way": { ar: "في الطريق", ckb: "لە ڕێگادا" },

  // Sending.
  "Send stock to another place": {
    ar: "أرسل مخزونًا إلى مكان آخر",
    ckb: "کۆگا بۆ شوێنێکی تر بنێرە",
  },
  "It leaves at what it costs where it is, the batch with the earliest use-by first, and is on its way until the other place receives it: counted there, what did not arrive is lost. While it is on its way it can be cancelled, and goes back where it was.":
    {
      ar: "يخرج بكلفته حيث هو، الدفعة ذات أقرب موعد استعمال أولًا، ويبقى في الطريق حتى يستلمه المكان الآخر: يُعدّ هناك، وما لم يصل يُعدّ خسارة. وما دام في الطريق يمكن إلغاؤه، فيعود إلى حيث كان.",
      ckb: "بە تێچووی خۆی لەو شوێنەی لێیەتی دەردەچێت، سەرەتا ئەو دەستەیەی کاتی بەکارهێنانی زووترە، و لە ڕێگادا دەمێنێت تا شوێنەکەی تر وەریدەگرێت: لەوێ دەژمێردرێت، و ئەوەی نەگەیشت زیانە. تا لە ڕێگادایە دەتوانرێت هەڵبوەشێندرێتەوە، و دەگەڕێتەوە بۆ ئەو شوێنەی لێی بوو.",
    },
  "There now": { ar: "الموجود هناك الآن", ckb: "ئێستا لەوێیە" },
  "Send it": { ar: "أرسله", ckb: "بینێرە" },
  "Send it all the same": { ar: "أرسله مع ذلك", ckb: "هەر بینێرە" },
  "Transfer {no} is on its way to {to}: {value}.": {
    ar: "التحويل {no} في الطريق إلى {to}: {value}.",
    ckb: "گواستنەوەی {no} لە ڕێگادایە بۆ {to}: {value}.",
  },

  // A transfer on its way: received, or cancelled.
  "Received: all of it": { ar: "استُلم: كله", ckb: "وەرگیرا: هەمووی" },
  "Not all of it arrived…": { ar: "لم يصل كله…", ckb: "هەمووی نەگەیشت…" },
  "Cancel it…": { ar: "ألغِه…", ckb: "هەڵیبوەشێنەوە…" },
  "Receive what arrived": { ar: "استلم ما وصل", ckb: "ئەوەی گەیشت وەربگرە" },
  "Cancel the transfer": { ar: "ألغِ التحويل", ckb: "گواستنەوەکە هەڵبوەشێنەوە" },
  "What arrived of each, in the unit it was sent in: what did not arrive is lost.": {
    ar: "ما وصل من كلٍّ منها، بالوحدة التي أُرسل بها: وما لم يصل يُعدّ خسارة.",
    ckb: "ئەوەی لە هەر یەکێکیان گەیشت، بەو یەکەیەی پێی نێردرا: ئەوەی نەگەیشت زیانە.",
  },
  "What arrived of {item}": { ar: "ما وصل من {item}", ckb: "ئەوەی لە {item} گەیشت" },
  "of {qty} {unit} sent": { ar: "من {qty} {unit} مُرسلة", ckb: "لە {qty} {unit}ی نێردراو" },
  "A tub fell, one came open…": {
    ar: "سقط وعاء، وانفتح آخر…",
    ckb: "قاپێک کەوت، یەکێکی تر کرایەوە…",
  },
  "Why the transfer is cancelled": {
    ar: "سبب إلغاء التحويل",
    ckb: "هۆی هەڵوەشاندنەوەی گواستنەوەکە",
  },
  "Sent to the wrong place, not needed after all…": {
    ar: "أُرسل إلى المكان الخطأ، لم تعد الحاجة إليه…",
    ckb: "بۆ شوێنی هەڵە نێردرا، ئیتر پێویست نییە…",
  },
  "Transfer {no} received: all of it.": {
    ar: "استُلم التحويل {no}: كله.",
    ckb: "گواستنەوەی {no} وەرگیرا: هەمووی.",
  },
  "Transfer {no} received: {value} arrived, {short} lost on the way.": {
    ar: "استُلم التحويل {no}: وصل {value}، وضاع {short} في الطريق.",
    ckb: "گواستنەوەی {no} وەرگیرا: {value} گەیشت، {short} لە ڕێگادا فەوتا.",
  },
  "Transfer {no} cancelled: back at {from}.": {
    ar: "أُلغي التحويل {no}: عاد إلى {from}.",
    ckb: "گواستنەوەی {no} هەڵوەشێنرایەوە: گەڕایەوە بۆ {from}.",
  },

  // A transfer, as the list shows it.
  "Transfer {no}": { ar: "التحويل {no}", ckb: "گواستنەوەی {no}" },
  "Sent by {who}, {when}: {value}": {
    ar: "أرسله {who}، {when}: {value}",
    ckb: "{who} ناردی، {when}: {value}",
  },
  "What arrived": { ar: "ما وصل", ckb: "ئەوەی گەیشت" },
  "Received by {who}, {when}": { ar: "استلمه {who}، {when}", ckb: "{who} وەریگرت، {when}" },
  "{short} lost on the way": { ar: "ضاع {short} في الطريق", ckb: "{short} لە ڕێگادا فەوتا" },
  "Cancelled by {who}, {when}: {reason}": {
    ar: "ألغاه {who}، {when}: {reason}",
    ckb: "{who} هەڵیوەشاندەوە، {when}: {reason}",
  },

  // What a form says when a transfer is wrong: "Choose {1}", "{1} is required".
  "where the stock goes": {
    ar: "المكان الذي يذهب إليه المخزون",
    ckb: "ئەو شوێنەی کۆگاکە بۆی دەچێت",
  },
  "a transfer": { ar: "تحويلًا", ckb: "گواستنەوەیەک" },

  // The audit trail and the journals: a transfer, sent, received or cancelled.
  Transfer: { ar: "التحويل", ckb: "گواستنەوە" },
  "A transfer": { ar: "تحويل", ckb: "گواستنەوەیەک" },
  "Stock sent to another place": {
    ar: "مخزون أُرسل إلى مكان آخر",
    ckb: "کۆگا بۆ شوێنێکی تر نێردرا",
  },
  "Transfer sent": { ar: "تحويل مُرسل", ckb: "گواستنەوەی نێردراو" },
  "Transfer received": { ar: "استُلم التحويل", ckb: "گواستنەوە وەرگیرا" },
  "Transfer cancelled": { ar: "أُلغي التحويل", ckb: "گواستنەوە هەڵوەشێنرایەوە" },
  "Lost on the way": { ar: "ضاع في الطريق", ckb: "لە ڕێگادا فەوتا" },
  "Counts, corrections, batches & transfers": {
    ar: "الجرد والتصحيحات والدفعات والتحويلات",
    ckb: "ژماردن، ڕاستکردنەوە، دەستەکان و گواستنەوەکان",
  },

  // A batch at every place it is at: its page (0054).
  "On its way to another place": { ar: "في الطريق إلى مكان آخر", ckb: "لە ڕێگادایە بۆ شوێنێکی تر" },
  "Sent to another place": { ar: "أُرسل إلى مكان آخر", ckb: "بۆ شوێنێکی تر نێردرا" },
  "Arrived from another place": { ar: "وصل من مكان آخر", ckb: "لە شوێنێکی ترەوە گەیشت" },
  "Back from a transfer cancelled": {
    ar: "عاد من تحويل مُلغى",
    ckb: "لە گواستنەوەیەکی هەڵوەشێنراوەوە گەڕایەوە",
  },
  "Every bit accounted for: made = sold + used + lost + on its way ± counts + left.": {
    ar: "كل الكمية معروفة المصير: المصنوع = المباع + المستعمل + الهدر + ما في الطريق ± الجرد + المتبقي.",
    ckb: "هەموو بڕەکە دیارە: دروستکراو = فرۆشراو + بەکارهاتوو + بەفیڕۆچوو + لە ڕێگادا ± ژماردن + ماوە.",
  },

  // The till at its branch (0055).
  "Till at": { ar: "نقطة البيع في", ckb: "خاڵی فرۆشتن لە" },
  "Sell at {place}": { ar: "البيع في {place}", ckb: "فرۆشتن لە {place}" },
  "{place} does not sell: the till is at a branch": {
    ar: "{place} لا يبيع: نقطة البيع في فرع",
    ckb: "{place} نافرۆشێت: خاڵی فرۆشتن لە لقێکدایە",
  },
  "This place": { ar: "هذا المكان", ckb: "ئەم شوێنە" },
  "Choose the branch this till is at.": {
    ar: "اختر الفرع الذي فيه نقطة البيع هذه.",
    ckb: "ئەو لقە هەڵبژێرە کە ئەم خاڵی فرۆشتنەی تێدایە.",
  },

  // Where each person works, on Settings (0055).
  "Works at": { ar: "يعمل في", ckb: "کار دەکات لە" },
  Everywhere: { ar: "في كل مكان", ckb: "لە هەموو شوێنێک" },
  "Where {name} works": { ar: "أين يعمل {name}", ckb: "{name} لە کوێ کار دەکات" },
  "{name} works at {place}.": {
    ar: "{name} يعمل في {place}.",
    ckb: "{name} لە {place} کار دەکات.",
  },
  "Where a person works changed": {
    ar: "تغيّر مكان عمل شخص",
    ckb: "شوێنی کارکردنی کەسێک گۆڕا",
  },
  "{name} works everywhere.": {
    ar: "{name} يعمل في كل مكان.",
    ckb: "{name} لە هەموو شوێنێک کار دەکات.",
  },

  // A branch's own prices, on Products & Recipes (0055).
  At: { ar: "في", ckb: "لە" },
  "Price at {place} changed from today.": {
    ar: "تغيّر السعر في {place} اعتبارًا من اليوم.",
    ckb: "نرخ لە {place} لە ئەمڕۆوە گۆڕا.",
  },
  "New price at {place} takes effect on {date}.": {
    ar: "يسري السعر الجديد في {place} من {date}.",
    ckb: "نرخی نوێ لە {place} لە {date}ەوە جێبەجێ دەبێت.",
  },
  "At {place}: {channel} {price}": {
    ar: "في {place}: {channel} {price}",
    ckb: "لە {place}: {channel} {price}",
  },
  "{channel} at {price}, at {place}": {
    ar: "{channel} بسعر {price}، في {place}",
    ckb: "{channel} بە نرخی {price}، لە {place}",
  },

  // What a place sends, and what is on its way to it (0055).
  "{have} on hand, {ordered} on order, {draft} in draft orders and {way} on its way from another place: {all} in all.":
    {
      ar: "{have} متوفّر، و{ordered} في الطلبيات، و{draft} في مسودات الطلبيات، و{way} في الطريق من مكان آخر: {all} إجمالًا.",
      ckb: "{have} بەردەستە، {ordered} لە داواکارییەکاندایە، {draft} لە ڕەشنووسی داواکارییەکاندا و {way} لە ڕێگادایە لە شوێنێکی ترەوە: {all} بە گشتی.",
    },
};

export default phrases;
