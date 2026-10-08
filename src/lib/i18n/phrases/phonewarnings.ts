import type { PhraseBook } from "./types";

/**
 * Round eleven, the owner's choice: warnings on your phone (0072) — the
 * dashboard's warnings sent to the phones of those who see them, turned on
 * for the café on Settings and on each phone on My account; and what the
 * database says of them.
 */
const phrases: PhraseBook = {
  // ------------------------------------------------- on My account
  "Warnings on this phone": {
    ar: "التنبيهات على هذا الهاتف",
    ckb: "ئاگادارکردنەوەکان لەسەر ئەم مۆبایلە",
  },
  "The warnings the dashboard shows under Needs you, sent to this phone as they come, in your language: what is short, late, below zero or out of the ordinary. Each is sent once, within about five minutes.":
    {
      ar: "التنبيهات التي تعرضها لوحة التحكم تحت «يحتاجك»، تُرسل إلى هذا الهاتف حين تظهر، بلغتك: ما هو ناقص أو متأخر أو تحت الصفر أو غير معتاد. يُرسل كل تنبيه مرة واحدة، في نحو خمس دقائق.",
      ckb: "ئەو ئاگادارکردنەوانەی داشبۆرد لە ژێر «پێویستی بە تۆیە» پیشانیان دەدات، کاتێک دەردەکەون بۆ ئەم مۆبایلە دەنێردرێن، بە زمانی خۆت: ئەوەی کەمە، دواکەوتووە، لە خوار سفرە یان نائاساییە. هەر یەکێکیان یەک جار دەنێردرێت، لە نزیکەی پێنج خولەکدا.",
    },
  "The owner has not turned phone warnings on for the café yet (Settings → Phone warnings).": {
    ar: "لم يشغّل المالك تنبيهات الهاتف للمقهى بعد («الإعدادات» ← «تنبيهات الهاتف»).",
    ckb: "خاوەنەکە هێشتا ئاگادارکردنەوەی مۆبایلی بۆ کافێکە کار پێنەکردووە («ڕێکخستنەکان» ← «ئاگادارکردنەوەی مۆبایل»).",
  },
  "Checking this phone…": { ar: "يجري فحص هذا الهاتف…", ckb: "ئەم مۆبایلە دەپشکنرێت…" },
  "This browser cannot take warnings. On an iPhone, first add the app to the Home Screen (Share → Add to Home Screen), then open it from there and come back here.":
    {
      ar: "لا يستطيع هذا المتصفح تلقي التنبيهات. على الآيفون، أضف التطبيق أولًا إلى الشاشة الرئيسية (مشاركة ← إضافة إلى الشاشة الرئيسية)، ثم افتحه من هناك وعد إلى هنا.",
      ckb: "ئەم وێبگەڕە ناتوانێت ئاگادارکردنەوە وەربگرێت. لەسەر ئایفۆن، سەرەتا ئەپەکە زیاد بکە بۆ شاشەی سەرەکی (Share ← Add to Home Screen)، پاشان لەوێوە بیکەرەوە و بگەڕێوە ئێرە.",
    },
  "Notifications are blocked for this app on this phone. Allow them in the browser's or the phone's settings for this site, then come back here.":
    {
      ar: "الإشعارات محظورة لهذا التطبيق على هذا الهاتف. اسمح بها في إعدادات المتصفح أو الهاتف لهذا الموقع، ثم عد إلى هنا.",
      ckb: "ئاگادارکردنەوەکان بۆ ئەم ئەپە لەسەر ئەم مۆبایلە ڕێگرییان لێکراوە. لە ڕێکخستنەکانی وێبگەڕ یان مۆبایل بۆ ئەم ماڵپەڕە ڕێگەیان پێبدە، پاشان بگەڕێوە ئێرە.",
    },
  "Only the urgent (red) ones": { ar: "العاجلة (الحمراء) فقط", ckb: "تەنها بەپەلەکان (سوورەکان)" },
  "Turn on warnings on this phone": {
    ar: "شغّل التنبيهات على هذا الهاتف",
    ckb: "ئاگادارکردنەوەکان لەسەر ئەم مۆبایلە کار پێبکە",
  },
  "On: the urgent ones only": { ar: "مُشغّلة: العاجلة فقط", ckb: "کارایە: تەنها بەپەلەکان" },
  "On: every warning": { ar: "مُشغّلة: كل التنبيهات", ckb: "کارایە: هەموو ئاگادارکردنەوەکان" },
  "Send a test": { ar: "أرسل تجربة", ckb: "تاقیکردنەوەیەک بنێرە" },
  "Turn off on this phone": { ar: "أوقفها على هذا الهاتف", ckb: "لەسەر ئەم مۆبایلە ڕایبگرە" },
  "Warnings will come to this phone.": {
    ar: "ستصل التنبيهات إلى هذا الهاتف.",
    ckb: "ئاگادارکردنەوەکان بۆ ئەم مۆبایلە دێن.",
  },
  "This phone's browser would not take warnings. Try again, or another browser.": {
    ar: "لم يقبل متصفح هذا الهاتف التنبيهات. حاول مرة أخرى، أو بمتصفح آخر.",
    ckb: "وێبگەڕی ئەم مۆبایلە ئاگادارکردنەوەکانی وەرنەگرت. دووبارە هەوڵ بدەرەوە، یان وێبگەڕێکی تر.",
  },
  "A test is on its way: it comes within a minute.": {
    ar: "التجربة في الطريق: تصل خلال دقيقة.",
    ckb: "تاقیکردنەوەکە لە ڕێگادایە: لە ماوەی خولەکێکدا دێت.",
  },
  "The test waits: the database cannot send yet (see Settings).": {
    ar: "التجربة تنتظر: قاعدة البيانات لا تستطيع الإرسال بعد (انظر «الإعدادات»).",
    ckb: "تاقیکردنەوەکە چاوەڕێ دەکات: داتابەیسەکە هێشتا ناتوانێت بنێرێت (سەیری «ڕێکخستنەکان» بکە).",
  },
  "Warnings will no longer come to this phone.": {
    ar: "لن تصل التنبيهات إلى هذا الهاتف بعد الآن.",
    ckb: "ئیتر ئاگادارکردنەوەکان بۆ ئەم مۆبایلە نایەن.",
  },
  "The database cannot send yet: nothing will come until it can (see Settings).": {
    ar: "قاعدة البيانات لا تستطيع الإرسال بعد: لن يصل شيء حتى تستطيع (انظر «الإعدادات»).",
    ckb: "داتابەیسەکە هێشتا ناتوانێت بنێرێت: هیچ نایەت تا بتوانێت (سەیری «ڕێکخستنەکان» بکە).",
  },

  // ------------------------------------------------- on Settings
  "Phone warnings": { ar: "تنبيهات الهاتف", ckb: "ئاگادارکردنەوەی مۆبایل" },
  "The warnings of the dashboard, sent to the phones of those who see them, in each one's language, within about five minutes. Turned on here once for the café; then each person turns them on on a phone, on My account.":
    {
      ar: "تنبيهات لوحة التحكم، تُرسل إلى هواتف من يرونها، بلغة كل منهم، في نحو خمس دقائق. تُشغَّل هنا مرة واحدة للمقهى؛ ثم يشغّلها كل شخص على هاتفه، في «حسابي».",
      ckb: "ئاگادارکردنەوەکانی داشبۆرد، بۆ مۆبایلی ئەوانەی دەیانبینن دەنێردرێن، بە زمانی هەر یەکێکیان، لە نزیکەی پێنج خولەکدا. لێرە یەک جار بۆ کافێکە کار پێدەکرێن؛ پاشان هەر کەسێک لەسەر مۆبایلەکەی کاریان پێدەکات، لە «هەژمارەکەم».",
    },
  "This needs the database update 0072, which has not been applied yet.": {
    ar: "يحتاج هذا إلى تحديث قاعدة البيانات 0072، ولم يُطبَّق بعد.",
    ckb: "ئەمە پێویستی بە نوێکردنەوەی داتابەیس 0072 هەیە، کە هێشتا جێبەجێ نەکراوە.",
  },
  "Turn phone warnings on for the café": {
    ar: "شغّل تنبيهات الهاتف للمقهى",
    ckb: "ئاگادارکردنەوەی مۆبایل بۆ کافێکە کار پێبکە",
  },
  "Turn phone warnings off for the café": {
    ar: "أوقف تنبيهات الهاتف للمقهى",
    ckb: "ئاگادارکردنەوەی مۆبایل بۆ کافێکە ڕابگرە",
  },
  "On: {n} phone(s) get them": {
    ar: "{n, plural, zero {مُشغّلة: لا يتلقاها أي هاتف بعد} one {مُشغّلة: يتلقاها هاتف واحد} two {مُشغّلة: يتلقاها هاتفان} few {مُشغّلة: يتلقاها # هواتف} many {مُشغّلة: يتلقاها # هاتفًا} other {مُشغّلة: يتلقاها # هاتف}}",
    ckb: "کارایە: {n} مۆبایل وەریاندەگرن",
  },
  "The database cannot send yet: it needs its timer and its calls out (the pg_cron and pg_net extensions, under Database → Extensions in Supabase). Nothing is sent until then.":
    {
      ar: "قاعدة البيانات لا تستطيع الإرسال بعد: تحتاج إلى مؤقّتها واتصالاتها الخارجية (الإضافتان pg_cron وpg_net، في Database ← Extensions في Supabase). لا يُرسل شيء حتى ذلك الحين.",
      ckb: "داتابەیسەکە هێشتا ناتوانێت بنێرێت: پێویستی بە کاتژمێرەکەی و پەیوەندییە دەرەکییەکانی هەیە (زیادکراوەکانی pg_cron و pg_net، لە Database ← Extensions لە Supabase). تا ئەو کاتە هیچ نانێردرێت.",
    },
  "Phone warnings are on. Each person turns them on on a phone, on My account.": {
    ar: "تنبيهات الهاتف مُشغّلة. يشغّلها كل شخص على هاتفه، في «حسابي».",
    ckb: "ئاگادارکردنەوەی مۆبایل کارایە. هەر کەسێک لەسەر مۆبایلەکەی کاری پێدەکات، لە «هەژمارەکەم».",
  },
  "Phone warnings are off: nothing more is sent.": {
    ar: "تنبيهات الهاتف متوقفة: لا يُرسل شيء بعد الآن.",
    ckb: "ئاگادارکردنەوەی مۆبایل ڕاگیراوە: ئیتر هیچ نانێردرێت.",
  },

  // ------------------------------------------------- what the database says
  "{1} new warnings at the café": {
    ar: "{1} تنبيهات جديدة في المقهى",
    ckb: "{1} ئاگادارکردنەوەی نوێ لە کافێکە",
  },
  "A test from the café: warnings come to this phone": {
    ar: "تجربة من المقهى: التنبيهات تصل إلى هذا الهاتف",
    ckb: "تاقیکردنەوەیەک لە کافێکەوە: ئاگادارکردنەوەکان بۆ ئەم مۆبایلە دێن",
  },
  "They come within about five minutes of being seen.": {
    ar: "تصل في نحو خمس دقائق من ظهورها.",
    ckb: "لە نزیکەی پێنج خولەک دوای دەرکەوتنیان دێن.",
  },
  "The app's address must be its https address": {
    ar: "يجب أن يكون عنوان التطبيق عنوان https الخاص به",
    ckb: "ناونیشانی ئەپەکە دەبێت ناونیشانی https ی خۆی بێت",
  },
  "The keys for sending are not valid": {
    ar: "مفاتيح الإرسال غير صالحة",
    ckb: "کلیلەکانی ناردن دروست نین",
  },
  "Phone warnings are not turned on for the café: the owner turns them on in Settings": {
    ar: "تنبيهات الهاتف غير مُشغّلة للمقهى: يشغّلها المالك في «الإعدادات»",
    ckb: "ئاگادارکردنەوەی مۆبایل بۆ کافێکە کارا نییە: خاوەنەکە لە «ڕێکخستنەکان» کاری پێدەکات",
  },
  "This phone's browser gave no address to send to": {
    ar: "لم يعطِ متصفح هذا الهاتف عنوانًا للإرسال إليه",
    ckb: "وێبگەڕی ئەم مۆبایلە هیچ ناونیشانێکی نەدا بۆ ناردن",
  },
  "Warnings are not turned on on this phone": {
    ar: "التنبيهات غير مُشغّلة على هذا الهاتف",
    ckb: "ئاگادارکردنەوەکان لەسەر ئەم مۆبایلە کارا نین",
  },
  "A test was sent a moment ago: wait a minute": {
    ar: "أُرسلت تجربة قبل لحظات: انتظر دقيقة",
    ckb: "تاقیکردنەوەیەک چەند ساتێک لەمەوبەر نێردرا: خولەکێک چاوەڕێ بکە",
  },
  "Not allowed": { ar: "غير مسموح", ckb: "ڕێگەپێنەدراوە" },
};

export default phrases;
