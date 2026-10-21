import type { PhraseBook } from "./types";

/** The approvals inbox (0088, E5), and undo for a few seconds (E7). */
const phrases: PhraseBook = {
  "What waits for a manager, oldest first. Stock counts, losses saved to wait, purchase orders and the month's pay: each with who asked, when, why and how much, approved or sent back here. Nobody approves what they asked for themselves.":
    {
      ar: "ما ينتظر مديرًا، الأقدم أولًا. الجرد، والخسائر المحفوظة للانتظار، وأوامر الشراء، ورواتب الشهر: كلٌّ مع من طلبه ومتى ولماذا وبكم، يُوافق عليه أو يُعاد من هنا. لا يوافق أحد على ما طلبه بنفسه.",
      ckb: "ئەوەی چاوەڕێی بەڕێوەبەرێکە، کۆنترینەکان سەرەتا. ژماردنی کۆگا، زیانە پاشەکەوتکراوەکان بۆ چاوەڕێ، داواکارییەکانی کڕین و مووچەی مانگ: هەریەکە لەگەڵ ئەوەی کێ داوای کرد، کەی، بۆچی و چەند، لێرەوە پەسەند دەکرێت یان دەگەڕێنرێتەوە. کەس ئەوەی خۆی داوای کردووە پەسەندی ناکات.",
    },
  "Nothing waits for you.": { ar: "لا شيء ينتظرك.", ckb: "هیچ شتێک چاوەڕێی تۆ نییە." },
  "The database needs an update for this screen": {
    ar: "قاعدة البيانات تحتاج تحديثًا لهذه الشاشة",
    ckb: "بنکەدراوەکە نوێکردنەوەیەکی پێویستە بۆ ئەم شاشەیە",
  },
  "Apply migration 0088 in the SQL editor.": {
    ar: "طبّق الترحيل 0088 في محرر SQL.",
    ckb: "کۆچی 0088 لە دەستکاریکەری SQL جێبەجێ بکە.",
  },
  "The month's pay": { ar: "رواتب الشهر", ckb: "مووچەی مانگ" },
  "{n} of {total} item(s) differ": {
    ar: "{n} من {total} تختلف",
    ckb: "{n} لە {total} جیاوازن",
  },
  "Over your limit": { ar: "فوق حدّك", ckb: "لە سەرووی سنووری تۆوە" },
  "{n} people": { ar: "الأشخاص: {n}", ckb: "{n} کەس" },
  "Send back for a recount…": { ar: "أعِده لإعادة الجرد…", ckb: "بیگەڕێنەوە بۆ دووبارە ژماردن…" },
  "Why is it sent back? (required)": {
    ar: "لماذا يُعاد؟ (مطلوب)",
    ckb: "بۆچی دەگەڕێنرێتەوە؟ (پێویستە)",
  },
  "Cancel the order…": { ar: "ألغِ الأمر…", ckb: "داواکارییەکە هەڵبوەشێنەوە…" },
  "Why is it cancelled? (required)": {
    ar: "لماذا يُلغى؟ (مطلوب)",
    ckb: "بۆچی هەڵدەوەشێنرێتەوە؟ (پێویستە)",
  },
  "Someone else approves what you asked for": {
    ar: "يوافق شخص آخر على ما طلبته",
    ckb: "کەسێکی تر ئەوەی تۆ داوات کردووە پەسەندی دەکات",
  },
  "Over your limit: a manager with a higher one approves it": {
    ar: "فوق حدّك: يوافق عليه مدير حدّه أعلى",
    ckb: "لە سەرووی سنووری تۆوە: بەڕێوەبەرێک کە سنووری بەرزترە پەسەندی دەکات",
  },
  "Open its page": { ar: "افتح صفحته", ckb: "پەڕەکەی بکەرەوە" },
  // The alert (0088).
  "Waiting for approval": { ar: "بانتظار الموافقة", ckb: "چاوەڕێی پەسەندکردن" },
  "{1} waiting for a manager's approval: {2} count(s), {3} order(s)": {
    ar: "بانتظار موافقة مدير: {1} (جرد: {2}، أوامر: {3})",
    ckb: "{1} چاوەڕێی پەسەندکردنی بەڕێوەبەرێکن: {2} ژماردن، {3} داواکاری",
  },
  "A stock count posts nothing, and an order goes to no supplier, until a manager approves it.": {
    ar: "لا يُرحَّل الجرد شيئًا، ولا يذهب أمر إلى مورّد، حتى يوافق عليه مدير.",
    ckb: "ژماردنی کۆگا هیچ تۆمار ناکات، و داواکاری بۆ هیچ دابینکەرێک ناچێت، تا بەڕێوەبەرێک پەسەندی نەکات.",
  },
  "Open Approvals: approve each one, or send it back with why.": {
    ar: "افتح «الموافقات»: وافق على كلٍّ منها، أو أعِده مع السبب.",
    ckb: "«پەسەندکردنەکان» بکەرەوە: هەریەکەیان پەسەند بکە، یان لەگەڵ هۆکارەکەی بیگەڕێنەوە.",
  },
  // Undo for a few seconds (E7).
  "Undo ({n})": { ar: "تراجع ({n})", ckb: "گەڕانەوە ({n})" },
  "Undone: as it was before.": {
    ar: "تم التراجع: كما كان من قبل.",
    ckb: "گەڕێندرایەوە: وەک پێشتر.",
  },
};

export default phrases;
