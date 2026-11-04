import type { PhraseBook } from "./types";

/** Where people get stuck (0097): each screen's refusals and help opened, for the owner. */
const phrases: PhraseBook = {
  "Where people get stuck": { ar: "أين يتعثّر الناس", ckb: "خەڵک لە کوێ گیر دەخۆن" },
  "Where people get stuck: the screens that stop people most →": {
    ar: "أين يتعثّر الناس: الشاشات التي توقف الناس أكثر →",
    ckb: "خەڵک لە کوێ گیر دەخۆن: ئەو شاشانەی زیاتر خەڵک ڕادەگرن ←",
  },
  "Back to Reports": { ar: "العودة إلى التقارير", ckb: "گەڕانەوە بۆ ڕاپۆرتەکان" },
  "Each time the database refuses something on a screen, or someone opens a screen's help, it is noted here. The screens at the top stop people most: make them plainer, or show people how, before adding more help. Practice is counted apart.":
    {
      ar: "في كل مرة ترفض فيها قاعدة البيانات شيئًا على شاشة، أو يفتح أحد مساعدة شاشة، يُسجَّل هنا. الشاشات في الأعلى توقف الناس أكثر: اجعلها أوضح، أو أرِ الناس كيف، قبل إضافة مساعدة أكثر. التدريب يُحسب على حدة.",
      ckb: "هەر جارێک بنکەدراوە شتێک لەسەر شاشەیەک ڕەت بکاتەوە، یان کەسێک یارمەتیی شاشەیەک بکاتەوە، لێرە تۆمار دەکرێت. ئەو شاشانەی لە سەرەوەن زیاتر خەڵک ڕادەگرن: ڕوونتریان بکە، یان نیشانی خەڵکیان بدە چۆن، پێش ئەوەی یارمەتی زیاتر زیاد بکەیت. ڕاهێنان جیا دەژمێردرێت.",
    },
  "Last {n} days": { ar: "آخر {n} يومًا", ckb: "{n} ڕۆژی ڕابردوو" },
  "No one was stuck": { ar: "لم يتعثّر أحد", ckb: "کەس گیری نەخوارد" },
  "Nothing was refused and no help was opened in these days.": {
    ar: "لم يُرفض شيء ولم تُفتح أي مساعدة في هذه الأيام.",
    ckb: "لەم ڕۆژانەدا هیچ شتێک ڕەت نەکرایەوە و هیچ یارمەتییەک نەکرایەوە.",
  },
  "Help opened": { ar: "فُتحت المساعدة", ckb: "یارمەتی کرایەوە" },
  "In practice": { ar: "في التدريب", ckb: "لە ڕاهێناندا" },
  "Said most": { ar: "الأكثر قولًا", ckb: "زۆرترین گوتراو" },
  "Before the app goes to a new café, watch two or three people who have never seen it do five tasks with no help, and fix what stops them: the steps are in the owner's guide.":
    {
      ar: "قبل أن يذهب التطبيق إلى مقهى جديد، راقب شخصين أو ثلاثة لم يروه من قبل وهم ينجزون خمس مهام دون مساعدة، وأصلح ما يوقفهم: الخطوات في دليل المالك.",
      ckb: "پێش ئەوەی ئەپەکە بچێتە کافێیەکی نوێ، سەیری دوو یان سێ کەس بکە کە هەرگیز نەیانبینیوە کاتێک پێنج ئەرک بەبێ یارمەتی دەکەن، و ئەوەی ڕایاندەگرێت چاکی بکە: هەنگاوەکان لە ڕێبەری خاوەندان.",
    },
  "Only the owner reads where people get stuck": {
    ar: "المالك وحده يقرأ أين يتعثّر الناس",
    ckb: "تەنها خاوەن دەخوێنێتەوە کە خەڵک لە کوێ گیر دەخۆن",
  },
};

export default phrases;
