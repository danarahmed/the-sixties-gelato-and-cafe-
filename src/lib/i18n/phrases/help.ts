import type { PhraseBook } from "./types";

/** The ? help on every screen, and the tours of each role's own screens (G3). */
const phrases: PhraseBook = {
  "Help for this screen": { ar: "مساعدة لهذه الشاشة", ckb: "یارمەتی بۆ ئەم شاشەیە" },
  "No help is written for this screen yet.": {
    ar: "لم تُكتب مساعدة لهذه الشاشة بعد.",
    ckb: "هێشتا یارمەتی بۆ ئەم شاشەیە نەنووسراوە.",
  },
  "What you can do here": { ar: "ما يمكنك فعله هنا", ckb: "ئەوەی لێرە دەتوانیت بیکەیت" },
  "How to get here": { ar: "كيف تصل إلى هنا", ckb: "چۆن دەگەیتە ئێرە" },
  "If…": { ar: "إذا…", ckb: "ئەگەر…" },
  "Good to know": { ar: "من المفيد معرفته", ckb: "باشە بزانیت" },
  "Your tasks on this screen": { ar: "مهامك على هذه الشاشة", ckb: "ئەرکەکانت لەسەر ئەم شاشەیە" },
  "Before you start": { ar: "قبل أن تبدأ", ckb: "پێش ئەوەی دەست پێبکەیت" },

  // The tours.
  "Your day": { ar: "يومك", ckb: "ڕۆژەکەت" },
  "How many of today's jobs are done. When all are, it says so.": {
    ar: "كم من مهام اليوم أُنجز. وعندما تُنجز كلها، يقول ذلك.",
    ckb: "چەند لە کارەکانی ئەمڕۆ تەواو کراون. کاتێک هەموویان تەواو بوون، دەیڵێت.",
  },
  "One job, one button": { ar: "مهمة واحدة، زر واحد", ckb: "یەک کار، یەک دوگمە" },
  "Each job of your role, in the order of the day. Its button goes straight to where it is done.": {
    ar: "كل مهمة من مهام دورك، بترتيب اليوم. زرها يأخذك مباشرة إلى حيث تُنجز.",
    ckb: "هەر کارێکی ڕۆڵەکەت، بە ڕیزی ڕۆژەکە. دوگمەکەی ڕاستەوخۆ دەتباتە ئەو شوێنەی تێیدا دەکرێت.",
  },
  "Help on every screen": { ar: "مساعدة على كل شاشة", ckb: "یارمەتی لەسەر هەموو شاشەیەک" },
  "Press ? on any screen: what it is for, what you can do there, and your tasks on it step by step.":
    {
      ar: "اضغط ? على أي شاشة: ما الغرض منها، وما يمكنك فعله فيها، ومهامك عليها خطوة بخطوة.",
      ckb: "لەسەر هەر شاشەیەک ? دابگرە: بۆ چییە، چی دەتوانیت لەوێ بکەیت، و ئەرکەکانت لەسەری هەنگاو بە هەنگاو.",
    },
  "The counts": { ar: "عمليات الجرد", ckb: "ژماردنەکان" },
  "Each count: who counted, when, and whether it waits for review. Start a count, type what is on the shelf, and send it.":
    {
      ar: "كل جرد: من جرده ومتى، وهل ينتظر المراجعة. ابدأ جردًا، واكتب ما على الرف، وأرسله.",
      ckb: "هەر ژماردنێک: کێ ژماردی، کەی، و ئایا چاوەڕێی پێداچوونەوەیە. ژماردنێک دەست پێبکە، ئەوەی لەسەر ڕەفەکەیە بنووسە، و بینێرە.",
    },
  "The items running low, with how much to order from whom.": {
    ar: "المواد التي توشك على النفاد، مع الكمية التي تُطلب ومن مَن.",
    ckb: "ئەو کاڵایانەی خەریکە تەواو دەبن، لەگەڵ بڕی داواکردن و لە کێ.",
  },
  "An order to a supplier: approve it, then send it.": {
    ar: "طلبية إلى مورّد: وافق عليها، ثم أرسلها.",
    ckb: "داواکارییەک بۆ دابینکەرێک: پەسەندی بکە، پاشان بینێرە.",
  },
  Receive: { ar: "استلم", ckb: "وەربگرە" },
  "What the supplier brought, line by line, with its prices: the stock and the books follow.": {
    ar: "ما أحضره المورّد، بندًا بندًا، مع أسعاره: يتبعه المخزون والدفاتر.",
    ckb: "ئەوەی دابینکەر هێنای، هێڵ بە هێڵ، لەگەڵ نرخەکانی: کۆگا و دەفتەرەکان بەدوایدا دێن.",
  },
  "The reports": { ar: "التقارير", ckb: "ڕاپۆرتەکان" },
  "Each report in a word; the ones you open most come first.": {
    ar: "كل تقرير بكلمة؛ وما تفتحه أكثر يأتي أولًا.",
    ckb: "هەر ڕاپۆرتێک بە وشەیەک؛ ئەوانەی زیاتر دەیانکەیتەوە یەکەم دێن.",
  },
  "Profit and loss": { ar: "الأرباح والخسائر", ckb: "قازانج و زیان" },
  "What came in and what it cost for the dates chosen: open a figure to see what is behind it.": {
    ar: "ما دخل وما كلّف في التواريخ المختارة: افتح رقمًا لترى ما وراءه.",
    ckb: "ئەوەی هات و ئەوەی تێچوو لە بەروارە هەڵبژێردراوەکاندا: ژمارەیەک بکەرەوە بۆ ئەوەی ببینیت لە پشتیەوە چییە.",
  },
  "The books checked against the till, the drawer and the stock: every line should be ticked.": {
    ar: "الدفاتر مُطابَقة مع نقطة البيع والدرج والمخزون: يجب أن يكون كل سطر مؤشَّرًا.",
    ckb: "دەفتەرەکان بەراورد کراون لەگەڵ خاڵی فرۆشتن و دەخیلە و کۆگا: دەبێت هەموو هێڵێک نیشانەی لەسەر بێت.",
  },
  Practise: { ar: "تدرّب", ckb: "ڕاهێنان بکە" },
  "A practice café of your own: the same screens, pretend money and stock. Nothing there reaches the books.":
    {
      ar: "مقهى تدريب خاص بك: الشاشات نفسها، ومال ومخزون غير حقيقيين. لا شيء هناك يصل إلى الدفاتر.",
      ckb: "کافێیەکی ڕاهێنانی تایبەت بە خۆت: هەمان شاشەکان، پارە و کۆگای ساختە. هیچ شتێک لەوێ ناگاتە دەفتەرەکان.",
    },
  "Your role's tasks, in order: each is ticked once you have done it in practice.": {
    ar: "مهام دورك، بالترتيب: كل منها يُؤشَّر عندما تنجزها في التدريب.",
    ckb: "ئەرکەکانی ڕۆڵەکەت، بە ڕیز: هەر یەکەیان نیشانە دەکرێت کاتێک لە ڕاهێناندا تەواوت کرد.",
  },
  "Who has practised, and who is ready.": {
    ar: "من تدرّب، ومن هو جاهز.",
    ckb: "کێ ڕاهێنانی کردووە، و کێ ئامادەیە.",
  },
};

export default phrases;
