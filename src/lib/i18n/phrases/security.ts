import type { PhraseBook } from "./types";

/**
 * Security fixes (0099): clocking from a phone only near the shop; the till's
 * lock; screens that fail and sign-ins from a new device, as alerts; the
 * sales a till still keeps.
 */
const phrases: PhraseBook = {
  // Where a place is, for clocking from a phone.
  "Clocking in or out from a phone is only near the place, or inside it, once the place has its spot. Stand there and press Here.":
    {
      ar: "تسجيل الحضور أو الانصراف من الهاتف يكون قرب المكان أو داخله فقط، متى حُدِّد موقعه. قف هناك واضغط «هنا».",
      ckb: "هاتن و ڕۆیشتن لە مۆبایلەوە تەنها لە نزیک شوێنەکە یان لە ناویدا دەبێت، کاتێک شوێنەکەی دیاری کرابێت. لەوێ بوەستە و «لێرە» لێبدە.",
    },
  "This device does not say where it is: use a phone or a tablet.": {
    ar: "هذا الجهاز لا يعطي موقعه: استعمل هاتفًا أو جهازًا لوحيًا.",
    ckb: "ئەم ئامێرە شوێنی خۆی نادات: مۆبایل یان تابلێت بەکاربهێنە.",
  },
  "Allow this device to say where it is, then press Here again.": {
    ar: "اسمح لهذا الجهاز بإعطاء موقعه، ثم اضغط «هنا» مرة أخرى.",
    ckb: "ڕێگە بدە ئەم ئامێرە شوێنی خۆی بڵێت، پاشان دووبارە «لێرە» لێبدە.",
  },
  "Where each place is": { ar: "موقع كل مكان", ckb: "شوێنی هەر جێگایەک" },
  "No spot: phones clock from anywhere": {
    ar: "بلا موقع: الهواتف تسجّل من أي مكان",
    ckb: "شوێن دیاری نەکراوە: مۆبایلەکان لە هەر شوێنێکەوە تۆمار دەکەن",
  },
  "Near is within": { ar: "القرب ضمن", ckb: "نزیک واتە لە ناو" },
  metres: { ar: "مترًا", ckb: "مەتر" },
  Here: { ar: "هنا", ckb: "لێرە" },
  "Take the spot away": { ar: "أزِل الموقع", ckb: "شوێنەکە لابە" },
  "the place": { ar: "المكان", ckb: "شوێنەکە" },
  "Choose the place": { ar: "اختر المكان", ckb: "شوێنەکە هەڵبژێرە" },
  "How near is 20 to 2,000 metres": {
    ar: "القرب من 20 إلى 2,000 متر",
    ckb: "نزیکی لە ٢٠ تا ٢,٠٠٠ مەترە",
  },
  "Give both where it is north and east, or neither": {
    ar: "أعطِ الموقع شمالًا وشرقًا معًا، أو لا تعطِ أيًّا منهما",
    ckb: "هەردوو باکوور و ڕۆژهەڵات بنووسە، یان هیچیان",
  },
  "That is not a place on the map": {
    ar: "هذا ليس مكانًا على الخريطة",
    ckb: "ئەمە شوێنێک نییە لەسەر نەخشە",
  },
  "Let this phone say where it is: clocking from a phone is at the shop": {
    ar: "اسمح لهذا الهاتف بإعطاء موقعه: التسجيل من الهاتف يكون في المحل",
    ckb: "ڕێگە بدە ئەم مۆبایلە شوێنی خۆی بڵێت: تۆمارکردن لە مۆبایلەوە لە دوکانەکەدا دەبێت",
  },
  "This phone is about {1} m from {2}: clock in or out there": {
    ar: "هذا الهاتف على بعد نحو {1} م من {2}: سجّل الحضور أو الانصراف هناك",
    ckb: "ئەم مۆبایلە نزیکەی {1} مەتر لە {2} دوورە: لەوێ هاتن یان ڕۆیشتن تۆمار بکە",
  },
  "Where a place is, for clocking from a phone": {
    ar: "موقع مكان، لتسجيل الحضور من الهاتف",
    ckb: "شوێنی جێگایەک، بۆ تۆمارکردنی هاتن لە مۆبایلەوە",
  },

  // The till's lock.
  "Lock a till nobody touches after this many minutes (0: never)": {
    ar: "اقفل شاشة البيع التي لا يلمسها أحد بعد هذا العدد من الدقائق (0: أبدًا)",
    ckb: "کاشێرێک کە کەس دەستی لێنادات دوای ئەوەندە خولەک دابخە (٠: هەرگیز)",
  },
  "A till nobody touches for this long covers itself and asks the person signed in for their PIN (their clock PIN or their approval PIN); anyone else signs out and in as themselves, so no sale is rung up under another's name. 0 never locks. Set for a branch, it is that branch's.":
    {
      ar: "شاشة البيع التي لا يلمسها أحد هذه المدة تُغطّى وتطلب ممن سجّل الدخول رمزه (رمز الحضور أو رمز الموافقة)؛ وغيره يسجّل الخروج ثم الدخول باسمه، فلا يُسجَّل بيع باسم غيره. 0 لا تُقفل أبدًا. وإن حُدِّد لفرع فهو لذلك الفرع.",
      ckb: "کاشێرێک کە ئەوەندە کات کەس دەستی لێنەدات خۆی دادەپۆشێت و PINی ئەو کەسە دەپرسێت کە چووەتە ژوورەوە (PINی هاتن یان PINی ڕەزامەندی)؛ هەر کەسێکی تر دەچێتە دەرەوە و بە ناوی خۆی دەچێتەوە ژوورەوە، بۆیە هیچ فرۆشتنێک بە ناوی کەسێکی ترەوە تۆمار ناکرێت. ٠ هەرگیز داناخرێت. ئەگەر بۆ لقێک دانرا، هی ئەو لقەیە.",
    },
  "The till is locked": { ar: "شاشة البيع مقفلة", ckb: "کاشێر داخراوە" },
  "{name}, type your PIN to go on. Not {name}? Sign out, and sign in as yourself.": {
    ar: "{name}، اكتب رمزك للمتابعة. لست {name}؟ سجّل الخروج، ثم ادخل باسمك.",
    ckb: "{name}، PINەکەت بنووسە بۆ بەردەوامبوون. {name} نیت؟ بچۆ دەرەوە، و بە ناوی خۆت بچۆرەوە ژوورەوە.",
  },
  Unlock: { ar: "افتح القفل", ckb: "بیکەرەوە" },
  "Too many wrong PINs: sign out, and sign in again": {
    ar: "رموز خاطئة كثيرة: سجّل الخروج، ثم ادخل مجددًا",
    ckb: "PINی هەڵەی زۆر: بچۆ دەرەوە، و دووبارە بچۆرەوە ژوورەوە",
  },
  "You have no PIN yet: sign out and in again, or a manager sets your clock PIN on Staff": {
    ar: "ليس لديك رمز بعد: سجّل الخروج ثم الدخول، أو يضع مدير رمز حضورك في «الموظفين»",
    ckb: "هێشتا PINت نییە: بچۆ دەرەوە و دووبارە بچۆرەوە، یان بەڕێوەبەرێک PINی هاتنت لە «کارمەندان» دادەنێت",
  },

  // Where people get stuck: the screens that failed.
  Failed: { ar: "فشلت", ckb: "شکستی هێنا" },

  // The sales a till still keeps.
  "the oldest {n} min ago: keep this till open until they are sent": {
    ar: "أقدمها منذ {n} دقيقة: أبقِ شاشة البيع هذه مفتوحة حتى تُرسل",
    ckb: "کۆنترینیان {n} خولەک لەمەوبەر: ئەم کاشێرە کراوە بهێڵەرەوە تا دەنێردرێن",
  },

  // The alerts, as the database writes them.
  "{1} screens failed in the last hour": {
    ar: "فشلت {1} شاشات في الساعة الماضية",
    ckb: "{1} شاشە لە کاتژمێری ڕابردوودا شکستیان هێنا",
  },
  "Something on a screen failed for the people using it: what they were doing may not have been recorded.":
    {
      ar: "فشل شيء في شاشة لمن يستعملها: ربما لم يُسجَّل ما كانوا يفعلونه.",
      ckb: "شتێک لە شاشەیەکدا بۆ ئەوانەی بەکاری دەهێنن شکستی هێنا: لەوانەیە ئەوەی دەیانکرد تۆمار نەکرابێت.",
    },
  "Open Reports → Where people get stuck to see which screen, and tell whoever looks after the app.":
    {
      ar: "افتح «التقارير ← أين يتعثّر الناس» لترى أي شاشة، وأخبر من يعتني بالتطبيق.",
      ckb: "«ڕاپۆرتەکان ← خەڵک لە کوێ دەوەستن» بکەرەوە بۆ بینینی کام شاشە، و بەو کەسە بڵێ کە ئاگاداری ئەپەکەیە.",
    },
  "{1} signed in from a new device: {2}": {
    ar: "دخل {1} من جهاز جديد: {2}",
    ckb: "{1} لە ئامێرێکی نوێوە چووە ژوورەوە: {2}",
  },
  "If it was not them, someone else knows their password.": {
    ar: "إن لم يكن هو، فشخص آخر يعرف كلمة مروره.",
    ckb: "ئەگەر خۆی نەبوو، کەسێکی تر وشەی نهێنییەکەی دەزانێت.",
  },
  "Ask them. If it was not them, deactivate them in Settings → People, then set a new password.": {
    ar: "اسأله. إن لم يكن هو، أوقفه في «الإعدادات ← الأشخاص»، ثم ضع كلمة مرور جديدة.",
    ckb: "لێی بپرسە. ئەگەر خۆی نەبوو، لە «ڕێکخستنەکان ← کەسەکان» ناچالاکی بکە، پاشان وشەی نهێنی نوێ دابنێ.",
  },
};

export default phrases;
