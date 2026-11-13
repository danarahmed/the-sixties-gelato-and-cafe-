import type { PhraseBook } from "./types";

/** The dollar's rate typed with each payment (0116): at the till and on Sales → Dollars. */
const phrases: PhraseBook = {
  "Dinars a dollar now": { ar: "الدنانير للدولار الآن", ckb: "دینار بۆ هەر دۆلارێک ئێستا" },
  "More than {n}% from {rate}, the last rate a manager used: a manager approves it with their PIN.":
    {
      ar: "أكثر من {n}% عن {rate}، آخر سعر استخدمه مدير: يوافق عليه مدير برمزه.",
      ckb: "زیاتر لە {n}% لە {rate}، دوایین نرخ کە بەڕێوەبەرێک بەکاری هێنا: بەڕێوەبەرێک بە PINـەکەی پەسەندی دەکات.",
    },
  "A manager last used this rate {n} hours ago: check it.": {
    ar: "استخدم مدير هذا السعر آخر مرة قبل {n} ساعة: تحقّق منه.",
    ckb: "بەڕێوەبەرێک دوایین جار {n} کاتژمێر لەمەوبەر ئەم نرخەی بەکار هێنا: پشکنینی بکە.",
  },
  "A manager approves this dollar rate": {
    ar: "يوافق مدير على سعر الدولار هذا",
    ckb: "بەڕێوەبەرێک ئەم نرخی دۆلارە پەسەند دەکات",
  },
  "Each dollar payment takes the rate typed for it, this one offered to start from; a cashier's within {n}% of it is taken, beyond it a manager approves it with their PIN. Dollars are counted in dinars to the nearest {step}, and change is given in dinars.":
    {
      ar: "كل دفعة بالدولار تأخذ السعر المكتوب لها، ويُعرض هذا للبدء منه؛ سعر الكاشير ضمن {n}% منه يُقبل، وما بعده يوافق عليه مدير برمزه. تُحسب الدولارات بالدينار لأقرب {step}، والباقي يُعطى بالدينار.",
      ckb: "هەر پارەدانێکی دۆلار ئەو نرخە وەردەگرێت کە بۆی نووسرا، ئەمە پێشنیار دەکرێت بۆ دەستپێکردن؛ نرخی کاشێر لە ناو {n}%ی ئەمە وەردەگیرێت، زیاتر لەوە بەڕێوەبەرێک بە PINـەکەی پەسەندی دەکات. دۆلار بە دینار بۆ نزیکترین {step} دەژمێردرێت، و گەڕاوە بە دینار دەدرێت.",
    },
  "The rates used this week": {
    ar: "الأسعار المستخدمة هذا الأسبوع",
    ckb: "ئەو نرخانەی ئەم هەفتەیە بەکارهاتن",
  },
  Times: { ar: "المرات", ckb: "جار" },
  Lowest: { ar: "الأدنى", ckb: "کەمترین" },
  Highest: { ar: "الأعلى", ckb: "زۆرترین" },
  "Beyond the band": { ar: "خارج النطاق", ckb: "دەرەوەی سنوور" },
  "Approved by a manager": { ar: "وافق عليه مدير", ckb: "بەڕێوەبەرێک پەسەندی کرد" },
  "A cashier's rate within, %": { ar: "سعر الكاشير ضمن، %", ckb: "نرخی کاشێر لە ناو، %" },
  "Saved: a cashier's rate within {n}% is taken.": {
    ar: "حُفظ: يُقبل سعر الكاشير ضمن {n}%.",
    ckb: "پاشەکەوت کرا: نرخی کاشێر لە ناو {n}% وەردەگیرێت.",
  },
  // From the database (0116).
  "{1} is more than {2}% from {3}, the last rate a manager used: a manager approves it with their PIN":
    {
      ar: "{1} أكثر من {2}% عن {3}، آخر سعر استخدمه مدير: يوافق عليه مدير برمزه",
      ckb: "{1} زیاتر لە {2}% لە {3}ە، دوایین نرخ کە بەڕێوەبەرێک بەکاری هێنا: بەڕێوەبەرێک بە PINـەکەی پەسەندی دەکات",
    },
  "No manager has used a dollar rate yet: a manager approves {1} with their PIN": {
    ar: "لم يستخدم أي مدير سعر دولار بعد: يوافق مدير على {1} برمزه",
    ckb: "هێشتا هیچ بەڕێوەبەرێک نرخی دۆلاری بەکار نەهێناوە: بەڕێوەبەرێک {1} بە PINـەکەی پەسەند دەکات",
  },
  "That approval was for another rate: ask again": {
    ar: "كانت تلك الموافقة لسعر آخر: اطلب من جديد",
    ckb: "ئەو پەسەندکردنە بۆ نرخێکی تر بوو: دووبارە داوا بکە",
  },
  "The dollars of one sale are taken at one rate": {
    ar: "دولارات البيع الواحد تؤخذ بسعر واحد",
    ckb: "دۆلارەکانی یەک فرۆشتن بە یەک نرخ وەردەگیرێن",
  },
  "Only the owner sets how far a cashier's rate may be": {
    ar: "المالك وحده يحدد مدى ابتعاد سعر الكاشير",
    ckb: "تەنها خاوەنەکە دیاری دەکات نرخی کاشێر چەند دوور دەتوانێت بێت",
  },
  "The band is from 0% to 20%": { ar: "النطاق من 0% إلى 20%", ckb: "سنوورەکە لە 0% تا 20%ە" },
};

export default phrases;
