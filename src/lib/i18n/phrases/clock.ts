import type { PhraseBook } from "./types";

/**
 * Round eight: clocking in on your own phone, with the shop's code (0068) —
 * the shop's clock screens on Staff and the till, a person's phone linked on
 * Staff, and the phone's own clock.
 */
const phrases: PhraseBook = {
  // ------------------------------------------------- The shop's clock, on Staff
  "The shop's clock": { ar: "ساعة الحضور في المحل", ckb: "کاتژمێری هاتن و ڕۆیشتنی دوکان" },
  "Staff clock in and out on their own phone: they scan the code on the shop's clock screen, which changes every 30 seconds, so it works only at the shop. Those without a phone clock in on the clock screen with their PIN.":
    {
      ar: "يسجّل الموظفون الحضور والانصراف من هواتفهم: يمسحون الرمز على شاشة الحضور في المحل، وهو يتغيّر كل 30 ثانية، فلا يعمل إلا في المحل. ومن ليس لديه هاتف يسجّل على شاشة الحضور برمز PIN.",
      ckb: "کارمەندان بە مۆبایلی خۆیان هاتن و ڕۆیشتن تۆمار دەکەن: کۆدەکەی سەر شاشەی هاتن و ڕۆیشتنی دوکان سکان دەکەن، کە هەموو 30 چرکەیەک دەگۆڕێت، بۆیە تەنها لە دوکان کار دەکات. ئەوانەی مۆبایلیان نییە لەسەر شاشەکە بە PIN تۆمار دەکەن.",
    },
  "No clock screen yet: everyone clocks in at the till with their PIN, as before.": {
    ar: "لا توجد شاشة حضور بعد: يسجّل الجميع الحضور على نقطة البيع برمز PIN، كما في السابق.",
    ckb: "هێشتا شاشەی هاتن و ڕۆیشتن نییە: هەمووان وەک پێشوو لەسەر خاڵی فرۆشتن بە PIN تۆمار دەکەن.",
  },
  "The database is not ready for clock screens yet.": {
    ar: "قاعدة البيانات ليست جاهزة لشاشات الحضور بعد.",
    ckb: "بنکەدراوەکە هێشتا ئامادە نییە بۆ شاشەکانی هاتن و ڕۆیشتن.",
  },
  "This device": { ar: "هذا الجهاز", ckb: "ئەم ئامێرە" },
  "Seen {when}": { ar: "آخر ظهور {when}", ckb: "دوایین دەرکەوتن {when}" },
  "Not seen yet": { ar: "لم يظهر بعد", ckb: "هێشتا دەرنەکەوتووە" },
  "Why it is taken out of use": { ar: "سبب إيقافها", ckb: "هۆی لەکارخستنی" },
  "e.g. The tablet broke": { ar: "مثلًا: تعطّل الجهاز اللوحي", ckb: "بۆ نموونە: تابلێتەکە تێکچوو" },
  "The clock screen is taken out of use.": {
    ar: "أُوقفت شاشة الحضور.",
    ckb: "شاشەی هاتن و ڕۆیشتن لە کار خرا.",
  },
  "Show the code on the whole screen": {
    ar: "اعرض الرمز على الشاشة كاملة",
    ckb: "کۆدەکە لەسەر هەموو شاشەکە پیشان بدە",
  },
  "On the till, the code is also in Clock in or out.": {
    ar: "على نقطة البيع، الرمز موجود أيضًا في «تسجيل الحضور أو الانصراف».",
    ckb: "لەسەر خاڵی فرۆشتن، کۆدەکە لە «تۆمارکردنی هاتن یان ڕۆیشتن»یش هەیە.",
  },
  "Do this on the device at the shop that will show the code: the till, or a tablet by the door.": {
    ar: "افعل هذا على الجهاز الموجود في المحل الذي سيعرض الرمز: نقطة البيع، أو جهاز لوحي عند الباب.",
    ckb: "ئەمە لەسەر ئەو ئامێرەی دوکان بکە کە کۆدەکە پیشان دەدات: خاڵی فرۆشتن، یان تابلێتێک لای دەرگاکە.",
  },
  "The till": { ar: "نقطة البيع", ckb: "خاڵی فرۆشتن" },
  "The clock screen's name": { ar: "اسم شاشة الحضور", ckb: "ناوی شاشەی هاتن و ڕۆیشتن" },
  "Where it is": { ar: "مكانها", ckb: "شوێنەکەی" },
  "where it is": { ar: "مكانها", ckb: "شوێنەکەی" },
  "a clock screen": { ar: "شاشة حضور", ckb: "شاشەیەکی هاتن و ڕۆیشتن" },
  "Make it the clock screen": { ar: "اجعله شاشة الحضور", ckb: "بیکە بە شاشەی هاتن و ڕۆیشتن" },
  "Make this device the shop's clock screen": {
    ar: "اجعل هذا الجهاز شاشة الحضور في المحل",
    ckb: "ئەم ئامێرە بکە بە شاشەی هاتن و ڕۆیشتنی دوکان",
  },
  "Make this device a clock screen too": {
    ar: "اجعل هذا الجهاز شاشة حضور أيضًا",
    ckb: "ئەم ئامێرەش بکە بە شاشەی هاتن و ڕۆیشتن",
  },
  "This device is the clock screen “{name}” now.": {
    ar: "هذا الجهاز هو شاشة الحضور «{name}» الآن.",
    ckb: "ئەم ئامێرە ئێستا شاشەی هاتن و ڕۆیشتنە بە ناوی «{name}».",
  },
  "The owner or the general manager makes a device at the shop the clock screen.": {
    ar: "يجعل المالك أو المدير العام جهازًا في المحل شاشةً للحضور.",
    ckb: "خاوەن یان بەڕێوەبەری گشتی ئامێرێکی دوکان دەکات بە شاشەی هاتن و ڕۆیشتن.",
  },

  // ------------------------------------------------------- The code on a screen
  "Scan with your phone to clock in or out": {
    ar: "امسح بهاتفك لتسجيل الحضور أو الانصراف",
    ckb: "بە مۆبایلەکەت سکان بکە بۆ تۆمارکردنی هاتن یان ڕۆیشتن",
  },
  "The shop's code to scan": { ar: "رمز المحل للمسح", ckb: "کۆدی دوکان بۆ سکانکردن" },
  "A new code in {n} s": { ar: "رمز جديد بعد {n} ث", ckb: "کۆدێکی نوێ دوای {n} چرکە" },
  "No phone? Choose your name and type your PIN.": {
    ar: "ليس لديك هاتف؟ اختر اسمك واكتب رمز PIN.",
    ckb: "مۆبایلت نییە؟ ناوەکەت هەڵبژێرە و PIN ەکەت بنووسە.",
  },
  "Clocks on their phone": { ar: "يسجّل من هاتفه", ckb: "بە مۆبایلەکەی تۆمار دەکات" },
  "In since {time}, on their phone": {
    ar: "حاضر منذ {time}، من هاتفه",
    ckb: "لێرەیە لە {time}ەوە، بە مۆبایلەکەی",
  },

  // ------------------------------------------------- A person's phone, on Staff
  "Phone linked": { ar: "الهاتف مربوط", ckb: "مۆبایل بەستراوەتەوە" },
  "Link their phone": { ar: "اربط هاتفه", ckb: "مۆبایلەکەی ببەستەوە" },
  "Their phone…": { ar: "هاتفه…", ckb: "مۆبایلەکەی…" },
  "A square to link {name}'s phone": {
    ar: "مربع لربط هاتف {name}",
    ckb: "چوارگۆشەیەک بۆ بەستنەوەی مۆبایلی {name}",
  },
  "{name}: scan this with your own phone's camera": {
    ar: "{name}: امسح هذا بكاميرا هاتفك الخاص",
    ckb: "{name}: ئەمە بە کامێرای مۆبایلی خۆت سکان بکە",
  },
  "Open the camera on your phone and point it at the square.": {
    ar: "افتح الكاميرا في هاتفك ووجّهها نحو المربع.",
    ckb: "کامێرای مۆبایلەکەت بکەرەوە و ڕووی بکە لە چوارگۆشەکە.",
  },
  "Open the link it shows, and press Link this phone.": {
    ar: "افتح الرابط الذي تعرضه، واضغط «اربط هذا الهاتف».",
    ckb: "ئەو بەستەرەی پیشانی دەدات بکەرەوە، و «ئەم مۆبایلە ببەستەوە» دابگرە.",
  },
  "The square works once, until {time}.": {
    ar: "يعمل المربع مرة واحدة، حتى {time}.",
    ckb: "چوارگۆشەکە یەک جار کار دەکات، تا {time}.",
  },
  "Waiting for the phone…": { ar: "بانتظار الهاتف…", ckb: "چاوەڕێی مۆبایلەکە…" },
  "This square is too old.": { ar: "هذا المربع قديم جدًا.", ckb: "ئەم چوارگۆشەیە زۆر کۆنە." },
  "Make a new one": { ar: "أنشئ واحدًا جديدًا", ckb: "دانەیەکی نوێ دروست بکە" },
  "The link, to send to their phone": {
    ar: "الرابط، لإرساله إلى هاتفه",
    ckb: "بەستەرەکە، بۆ ناردن بۆ مۆبایلەکەی",
  },
  "Linked: {name}'s phone clocks them in and out now.": {
    ar: "تم الربط: هاتف {name} يسجّل حضوره وانصرافه الآن.",
    ckb: "بەسترایەوە: مۆبایلی {name} ئێستا هاتن و ڕۆیشتنی تۆمار دەکات.",
  },
  "Their phone is linked since {when}.": {
    ar: "هاتفه مربوط منذ {when}.",
    ckb: "مۆبایلەکەی لە {when}ەوە بەستراوەتەوە.",
  },
  "Last used {when}.": { ar: "آخر استخدام {when}.", ckb: "دوایین بەکارهێنان {when}." },
  "Link a new phone": { ar: "اربط هاتفًا جديدًا", ckb: "مۆبایلێکی نوێ ببەستەوە" },
  "Unlink…": { ar: "فكّ الربط…", ckb: "لابردنی بەستنەوە…" },
  "Why the phone is no longer theirs": {
    ar: "سبب فكّ ربط الهاتف",
    ckb: "هۆی لابردنی بەستنەوەی مۆبایلەکە",
  },
  "e.g. They lost it": { ar: "مثلًا: فقده", ckb: "بۆ نموونە: ونی کرد" },
  "Unlink the phone": { ar: "فكّ ربط الهاتف", ckb: "بەستنەوەی مۆبایلەکە لابدە" },

  // ----------------------------------------------------------- On the phone
  "Link this phone": { ar: "اربط هذا الهاتف", ckb: "ئەم مۆبایلە ببەستەوە" },
  "This phone is linked": { ar: "هذا الهاتف مربوط", ckb: "ئەم مۆبایلە بەستراوەتەوە" },
  "This phone will clock you in and out at the shop, without a PIN. Press the button on your own phone only.":
    {
      ar: "سيسجّل هذا الهاتف حضورك وانصرافك في المحل دون رمز PIN. اضغط الزر على هاتفك أنت فقط.",
      ckb: "ئەم مۆبایلە بەبێ PIN هاتن و ڕۆیشتنت لە دوکان تۆمار دەکات. تەنها لەسەر مۆبایلی خۆت دوگمەکە دابگرە.",
    },
  "This phone clocks in {name} now: linking it makes it the new person's.": {
    ar: "يسجّل هذا الهاتف حضور {name} الآن: ربطه يجعله للشخص الجديد.",
    ckb: "ئەم مۆبایلە ئێستا هاتنی {name} تۆمار دەکات: بەستنەوەی دەیکاتە هی کەسە نوێیەکە.",
  },
  "This phone clocks in {name} now.": {
    ar: "يسجّل هذا الهاتف حضور {name} الآن.",
    ckb: "ئەم مۆبایلە ئێستا هاتنی {name} تۆمار دەکات.",
  },
  "Each time you come in or leave, scan the code on the shop's clock screen with this phone's camera, and press Clock in or Clock out.":
    {
      ar: "في كل مرة تصل فيها أو تغادر، امسح الرمز على شاشة الحضور في المحل بكاميرا هذا الهاتف، ثم اضغط «تسجيل الحضور» أو «تسجيل الانصراف».",
      ckb: "هەر جارێک کە دێیت یان دەڕۆیت، کۆدەکەی سەر شاشەی هاتن و ڕۆیشتنی دوکان بە کامێرای ئەم مۆبایلە سکان بکە، و «تۆمارکردنی هاتن» یان «تۆمارکردنی ڕۆیشتن» دابگرە.",
    },
  "Open the clock": { ar: "افتح ساعة الحضور", ckb: "کاتژمێرەکە بکەرەوە" },
  "The clock is not ready yet": {
    ar: "ساعة الحضور ليست جاهزة بعد",
    ckb: "کاتژمێرەکە هێشتا ئامادە نییە",
  },
  "The café's database needs its update before phones can clock in.": {
    ar: "تحتاج قاعدة بيانات المقهى إلى تحديثها قبل أن تسجّل الهواتف الحضور.",
    ckb: "بنکەدراوەی کافێکە پێویستی بە نوێکردنەوە هەیە پێش ئەوەی مۆبایلەکان هاتن تۆمار بکەن.",
  },
  "This phone is not linked yet": {
    ar: "هذا الهاتف غير مربوط بعد",
    ckb: "ئەم مۆبایلە هێشتا نەبەستراوەتەوە",
  },
  "A manager links it on Staff: they show you a square, and you scan it with this phone's camera. Then this phone clocks you in and out.":
    {
      ar: "يربطه المدير في شاشة «الموظفون»: يعرض لك مربعًا، فتمسحه بكاميرا هذا الهاتف. بعدها يسجّل هذا الهاتف حضورك وانصرافك.",
      ckb: "بەڕێوەبەرێک لە شاشەی «کارمەندان» دەیبەستێتەوە: چوارگۆشەیەکت پیشان دەدات و تۆ بە کامێرای ئەم مۆبایلە سکانی دەکەیت. پاشان ئەم مۆبایلە هاتن و ڕۆیشتنت تۆمار دەکات.",
    },
  "In since {time}, at {place}": {
    ar: "حاضر منذ {time}، في {place}",
    ckb: "لێرەیە لە {time}ەوە، لە {place}",
  },
  "Not clocked in": { ar: "لم يُسجَّل الحضور", ckb: "هاتن تۆمار نەکراوە" },
  "Scan the code on the shop's clock screen with this phone's camera.": {
    ar: "امسح الرمز على شاشة الحضور في المحل بكاميرا هذا الهاتف.",
    ckb: "کۆدەکەی سەر شاشەی هاتن و ڕۆیشتنی دوکان بە کامێرای ئەم مۆبایلە سکان بکە.",
  },
  "Or type the 6 digits it shows": {
    ar: "أو اكتب الأرقام الستة التي تعرضها",
    ckb: "یان ئەو 6 ژمارەیەی پیشانی دەدات بنووسە",
  },
  "Type the 6 digits the shop's screen shows": {
    ar: "اكتب الأرقام الستة التي تعرضها شاشة المحل",
    ckb: "ئەو 6 ژمارەیەی شاشەی دوکان پیشانی دەدات بنووسە",
  },
};

export default phrases;
