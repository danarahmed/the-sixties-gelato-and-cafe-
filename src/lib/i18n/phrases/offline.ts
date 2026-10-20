import type { PhraseBook } from "./types";

/**
 * Selling without internet (round fifteen, 0073): the till's word on the sales
 * it keeps while the café's connection is down, what it cannot take offline,
 * and a manager's list of those the database refused.
 */
const phrases: PhraseBook = {
  // Bills changed or paid while the connection is down (0082).
  "Kept on this till: saved when the internet is back": {
    ar: "محفوظ على هذا الصندوق: يُحفظ عند عودة الإنترنت",
    ckb: "لەسەر ئەم سندوقە پارێزراوە: کاتێک ئینتەرنێت گەڕایەوە پاشەکەوت دەکرێت",
  },
  new: { ar: "جديد", ckb: "نوێ" },
  "No internet: this bill is kept on this till and sent when the connection is back.": {
    ar: "لا يوجد إنترنت: تُحفظ هذه الفاتورة على هذا الصندوق وتُرسل عند عودة الاتصال.",
    ckb: "ئینتەرنێت نییە: ئەم حسابە لەسەر ئەم سندوقە دەپارێزرێت و کاتێک پەیوەندی گەڕایەوە دەنێردرێت.",
  },
  "{n} bill(s) kept on this till": {
    ar: "{n} فاتورة محفوظة على هذا الصندوق",
    ckb: "{n} حساب لەسەر ئەم سندوقە پارێزراوە",
  },
  "Bills changed offline": {
    ar: "فواتير تغيّرت دون إنترنت",
    ckb: "حسابە گۆڕاوەکان بەبێ ئینتەرنێت",
  },
  "Drop these changes": { ar: "تجاهل هذه التغييرات", ckb: "ئەم گۆڕانکارییانە لابدە" },
  "This bill was paid on another till while this one was offline: give back what was taken twice": {
    ar: "دُفعت هذه الفاتورة على صندوق آخر بينما كان هذا دون إنترنت: أعد ما أُخذ مرتين",
    ckb: "ئەم حسابە لە سندوقێکی تر دراوە کاتێک ئەمە بێ ئینتەرنێت بوو: ئەوەی دوو جار وەرگیراوە بیگەڕێنەوە",
  },
  // The pay dialog and the order, with no connection.
  "No internet: this sale is kept on this till and sent when the connection is back.": {
    ar: "لا يوجد إنترنت: يُحفظ هذا البيع على هذا الصندوق ويُرسل عند عودة الاتصال.",
    ckb: "ئینتەرنێت نییە: ئەم فرۆشتنە لەسەر ئەم سندوقە دەپارێزرێت و کاتێک پەیوەندی گەڕایەوە دەنێردرێت.",
  },
  "No internet: quick sales are kept on this till and sent when the connection is back.": {
    ar: "لا يوجد إنترنت: تُحفظ المبيعات السريعة على هذا الصندوق وتُرسل عند عودة الاتصال.",
    ckb: "ئینتەرنێت نییە: فرۆشتنە خێراکان لەسەر ئەم سندوقە دەپارێزرێن و کاتێک پەیوەندی گەڕایەوە دەنێردرێن.",
  },
  "A bill on a table needs the internet: sell it as a quick sale": {
    ar: "فاتورة الطاولة تحتاج إلى الإنترنت: بِعها كبيع سريع",
    ckb: "وەسڵی مێز ئینتەرنێتی پێویستە: وەک فرۆشتنی خێرا بیفرۆشە",
  },
  "The café's own delivery needs the internet": {
    ar: "توصيل المقهى الخاص يحتاج إلى الإنترنت",
    ckb: "گەیاندنی خودی کافێ ئینتەرنێتی پێویستە",
  },
  "A discount needs the internet: take it off to sell offline": {
    ar: "الخصم يحتاج إلى الإنترنت: أزِله للبيع دون اتصال",
    ckb: "داشکاندن ئینتەرنێتی پێویستە: لای ببە بۆ ئەوەی بێ ئینتەرنێت بفرۆشیت",
  },
  "A customer needs the internet: take them off to sell offline": {
    ar: "الزبون يحتاج إلى الإنترنت: أزِله للبيع دون اتصال",
    ckb: "کڕیار ئینتەرنێتی پێویستە: لای ببە بۆ ئەوەی بێ ئینتەرنێت بفرۆشیت",
  },
  // The receipt of a sale kept on the till.
  "Offline {n}": { ar: "دون اتصال {n}", ckb: "بێ ئینتەرنێت {n}" },
  "Kept on this till · {ref}": {
    ar: "محفوظ على هذا الصندوق · {ref}",
    ckb: "لەسەر ئەم سندوقە پارێزراوە · {ref}",
  },
  // The strip beside the drawer.
  "{n} offline sale(s) need a manager": {
    ar: "{n, plural, one {بيع واحد دون اتصال يحتاج إلى مدير} two {بيعان دون اتصال يحتاجان إلى مدير} few {# مبيعات دون اتصال تحتاج إلى مدير} other {# بيعًا دون اتصال تحتاج إلى مدير}}",
    ckb: "{n} فرۆشتنی بێ ئینتەرنێت پێویستیان بە بەڕێوەبەرە",
  },
  "No internet · {n} sale(s) kept on this till": {
    ar: "لا يوجد إنترنت · {n, plural, one {بيع واحد محفوظ} two {بيعان محفوظان} few {# مبيعات محفوظة} other {# بيعًا محفوظًا}} على هذا الصندوق",
    ckb: "ئینتەرنێت نییە · {n} فرۆشتن لەسەر ئەم سندوقە پارێزراون",
  },
  "No internet · selling offline": {
    ar: "لا يوجد إنترنت · البيع دون اتصال",
    ckb: "ئینتەرنێت نییە · فرۆشتن بێ ئینتەرنێت",
  },
  "Sending {n} sale(s) made offline…": {
    ar: "جارٍ إرسال {n, plural, one {بيع واحد} two {بيعين} few {# مبيعات} other {# بيعًا}} تمت دون اتصال…",
    ckb: "ناردنی {n} فرۆشتنی بێ ئینتەرنێت…",
  },
  "{n} sale(s) made offline waiting to send": {
    ar: "{n, plural, one {بيع واحد} two {بيعان} few {# مبيعات} other {# بيعًا}} دون اتصال بانتظار الإرسال",
    ckb: "{n} فرۆشتنی بێ ئینتەرنێت چاوەڕێی ناردنن",
  },
  // The drawer, while sales wait.
  "{n} sale(s) made offline are not sent yet: the drawer is counted once they are, so its cash agrees.":
    {
      ar: "{n, plural, one {بيع واحد دون اتصال لم يُرسل} two {بيعان دون اتصال لم يُرسلا} few {# مبيعات دون اتصال لم تُرسل} other {# بيعًا دون اتصال لم تُرسل}} بعد: يُعدّ الدرج بعد إرسالها ليتطابق نقده.",
      ckb: "{n} فرۆشتنی بێ ئینتەرنێت هێشتا نەنێردراون: چەکمەجەکە دوای ناردنیان دەژمێردرێت، تا پارەکەی ڕێک بێت.",
    },
  // The manager's list.
  "Sales made offline": { ar: "المبيعات دون اتصال", ckb: "فرۆشتنەکانی بێ ئینتەرنێت" },
  "Each is sent by itself as soon as the internet is back, never twice. One the database refuses waits here for a manager.":
    {
      ar: "يُرسل كلٌّ منها تلقائيًا فور عودة الإنترنت، ولا يُسجَّل مرتين. وما ترفضه قاعدة البيانات ينتظر هنا مديرًا.",
      ckb: "هەر یەکێکیان خۆکارانە دەنێردرێت هەر کە ئینتەرنێت گەڕایەوە، هەرگیز دوو جار تۆمار ناکرێت. ئەوەی بنکەی زانیاری ڕەتی دەکاتەوە لێرە چاوەڕێی بەڕێوەبەر دەکات.",
    },
  "Every sale made offline has been sent.": {
    ar: "أُرسلت كل المبيعات التي تمت دون اتصال.",
    ckb: "هەموو فرۆشتنەکانی بێ ئینتەرنێت نێردران.",
  },
  "Sending…": { ar: "جارٍ الإرسال…", ckb: "دەنێردرێت…" },
  "Waiting for the internet": { ar: "بانتظار الإنترنت", ckb: "چاوەڕێی ئینتەرنێت" },
  "Send again": { ar: "أرسل مجددًا", ckb: "دووبارە بنێرە" },
  "Record at today's price": { ar: "سجّل بسعر اليوم", ckb: "بە نرخی ئەمڕۆ تۆماری بکە" },
  "Take it off this till": { ar: "أزِله من هذا الصندوق", ckb: "لەسەر ئەم سندوقە لای ببە" },
  // The audit trail.
  "Sale made offline, then sent": {
    ar: "بيع تمّ دون اتصال ثم أُرسل",
    ckb: "فرۆشتنێکی بێ ئینتەرنێت، دواتر نێردرا",
  },
  "Sold offline": { ar: "بيع دون اتصال", ckb: "بێ ئینتەرنێت فرۆشرا" },
  "Sold at": { ar: "وقت البيع", ckb: "کاتی فرۆشتن" },
  "Sold by": { ar: "البائع", ckb: "فرۆشیار" },
  "Sent by": { ar: "أرسله", ckb: "نێردرا لەلایەن" },
  "Take it off: its cash shows over in the drawer's count": {
    ar: "أزِله: سيظهر نقده زائدًا في عدّ الدرج",
    ckb: "لای ببە: پارەکەی لە ژماردنی چەکمەجەدا وەک زیادە دەردەکەوێت",
  },
};

export default phrases;
