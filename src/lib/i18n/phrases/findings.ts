import type { PhraseBook } from "./types";

/**
 * What writing the guide found, put right (0095): a delivery worth nothing,
 * the café's details and places on Settings, backup codes for the second
 * step, one phone for one person, and the words that read wrong.
 */
const phrases: PhraseBook = {
  // A delivery worth nothing.
  "Freight and other costs are shared by what the lines are worth: give the lines their prices": {
    ar: "تُوزَّع أجرة النقل والتكاليف الأخرى حسب قيمة البنود: أعطِ البنود أسعارها",
    ckb: "کرێی گواستنەوە و تێچووەکانی تر بەپێی نرخی هێڵەکان دابەش دەکرێن: نرخی هێڵەکان دابنێ",
  },
  "Delivery {1} came free: nothing to correct. Send its goods back, or record them as a loss": {
    ar: "التوريد {1} جاء مجانًا: لا شيء لتصحيحه. أعِد بضاعته، أو سجّلها خسارة",
    ckb: "باری {1} بەخۆڕایی هات: هیچ نییە بۆ ڕاستکردنەوە. کاڵاکانی بگەڕێنەوە، یان وەک زیان تۆماریان بکە",
  },
  "It came free: nothing to correct. Send its goods back, or record them as a loss": {
    ar: "جاء مجانًا: لا شيء لتصحيحه. أعِد بضاعته، أو سجّلها خسارة",
    ckb: "بەخۆڕایی هات: هیچ نییە بۆ ڕاستکردنەوە. کاڵاکانی بگەڕێنەوە، یان وەک زیان تۆماریان بکە",
  },
  "Delivery {1} came free: send its goods back without naming it": {
    ar: "التوريد {1} جاء مجانًا: أعِد بضاعته دون ذكره",
    ckb: "باری {1} بەخۆڕایی هات: کاڵاکانی بگەڕێنەوە بەبێ ناوهێنانی",
  },

  // The café's details.
  "Only the owner changes the café's details": {
    ar: "المالك وحده يغيّر بيانات المقهى",
    ckb: "تەنها خاوەن زانیارییەکانی کافێ دەگۆڕێت",
  },
  "The café's name is 2 to 80 letters": {
    ar: "اسم المقهى من 2 إلى 80 حرفًا",
    ckb: "ناوی کافێ 2 بۆ 80 پیتە",
  },
  "Choose one of the café's languages": {
    ar: "اختر إحدى لغات المقهى",
    ckb: "یەکێک لە زمانەکانی کافێ هەڵبژێرە",
  },
  "The currency, the time zone and bill numbers are fixed once the café has sold or posted anything":
    {
      ar: "العملة والمنطقة الزمنية وأرقام الفواتير تثبت بعد أن يبيع المقهى أو يسجّل أي شيء",
      ckb: "دراو و ناوچەی کات و ژمارەی پسوولەکان جێگیر دەبن کاتێک کافێ شتێکی فرۆشت یان تۆمار کرد",
    },
  "A currency is three capital letters, e.g. IQD": {
    ar: "العملة ثلاثة أحرف كبيرة، مثل IQD",
    ckb: "دراو سێ پیتی گەورەیە، بۆ نموونە IQD",
  },
  "The currency's sign is 1 to 6 letters": {
    ar: "رمز العملة من 1 إلى 6 أحرف",
    ckb: "هێمای دراو 1 بۆ 6 پیتە",
  },
  "A currency has 0 to 3 decimal places": {
    ar: "للعملة من 0 إلى 3 خانات عشرية",
    ckb: "دراو 0 بۆ 3 ژمارەی دوای خاڵی هەیە",
  },
  "That is not a time zone, e.g. Asia/Baghdad": {
    ar: "هذه ليست منطقة زمنية، مثل Asia/Baghdad",
    ckb: "ئەمە ناوچەی کات نییە، بۆ نموونە Asia/Baghdad",
  },
  "Bill numbers start with 2 to 8 capital letters or digits, a letter first": {
    ar: "تبدأ أرقام الفواتير بـ 2 إلى 8 أحرف كبيرة أو أرقام، أولها حرف",
    ckb: "ژمارەی پسوولەکان بە 2 بۆ 8 پیتی گەورە یان ژمارە دەست پێدەکەن، یەکەمیان پیتە",
  },

  // Places.
  "A place's name is 2 to 60 letters": {
    ar: "اسم المكان من 2 إلى 60 حرفًا",
    ckb: "ناوی شوێن 2 بۆ 60 پیتە",
  },
  "There is a place called {1} already": {
    ar: "يوجد مكان باسم {1} من قبل",
    ckb: "شوێنێک بە ناوی {1} پێشتر هەیە",
  },
  "Choose what kind of place it is": { ar: "اختر نوع المكان", ckb: "جۆری شوێنەکە هەڵبژێرە" },
  "That place is not one of the café's": {
    ar: "هذا المكان ليس من أماكن المقهى",
    ckb: "ئەو شوێنە هی کافێ نییە",
  },
  "Say why the place closes": { ar: "اذكر سبب إغلاق المكان", ckb: "بڵێ بۆچی شوێنەکە دادەخرێت" },
  "The café keeps at least one branch open": {
    ar: "يبقى للمقهى فرع واحد مفتوح على الأقل",
    ckb: "کافێ لانیکەم یەک لقی کراوە دەهێڵێتەوە",
  },
  "{1} has a drawer open: close it first": {
    ar: "في {1} درج مفتوح: أغلقه أولًا",
    ckb: "{1} دەخیلەیەکی کراوەی هەیە: سەرەتا دایبخە",
  },
  "{1} still holds stock: send it to another place, or record it as a loss, first": {
    ar: "ما زال في {1} مخزون: أرسله إلى مكان آخر، أو سجّله خسارة، أولًا",
    ckb: "{1} هێشتا کۆگای تێدایە: سەرەتا بینێرە بۆ شوێنێکی تر، یان وەک زیان تۆماری بکە",
  },
  "{1} has a table's bill open: settle or cancel it first": {
    ar: "في {1} فاتورة طاولة مفتوحة: سدّدها أو ألغِها أولًا",
    ckb: "{1} پسوولەی مێزێکی کراوەی هەیە: سەرەتا پارەکەی وەربگرە یان هەڵیبوەشێنەوە",
  },
  "{1} has a pre-order waiting: collect or cancel it first": {
    ar: "في {1} طلب مسبق ينتظر: سلّمه أو ألغِه أولًا",
    ckb: "{1} داواکارییەکی پێشوەختەی چاوەڕوانی هەیە: سەرەتا ڕادەستی بکە یان هەڵیبوەشێنەوە",
  },

  // Backup codes for the second step.
  "Turn on the second step first": {
    ar: "فعّل الخطوة الثانية أولًا",
    ckb: "سەرەتا هەنگاوی دووەم چالاک بکە",
  },
  "That backup code is not right, or was used already": {
    ar: "رمز الاحتياط هذا غير صحيح، أو استُخدم من قبل",
    ckb: "ئەم کۆدە یەدەگە دروست نییە، یان پێشتر بەکارهاتووە",
  },
  "Too many tries: wait an hour, then try again": {
    ar: "محاولات كثيرة: انتظر ساعة، ثم حاول مجددًا",
    ckb: "هەوڵی زۆر: کاتژمێرێک چاوەڕێ بکە، پاشان دووبارە هەوڵ بدەرەوە",
  },

  // A stock count's state, in words.
  Counting: { ar: "قيد العدّ", ckb: "لە ژماردندایە" },
  "Waiting for review": { ar: "بانتظار المراجعة", ckb: "چاوەڕێی پێداچوونەوەیە" },
  Rejected: { ar: "مرفوض", ckb: "ڕەتکراوە" },

  // The café's details, on Settings.
  "This needs the database update 0095, which has not been applied yet.": {
    ar: "يحتاج هذا إلى تحديث قاعدة البيانات 0095، ولم يُطبَّق بعد.",
    ckb: "ئەمە پێویستی بە نوێکردنەوەی بنکەدراوەی 0095 هەیە، کە هێشتا جێبەجێ نەکراوە.",
  },
  "Fixed: the café has sold or posted with it, and every record reads by it.": {
    ar: "ثابت: باع المقهى أو سجّل به، وكل سجل يُقرأ به.",
    ckb: "جێگیرە: کافێ پێی فرۆشتووە یان تۆماری کردووە، و هەموو تۆمارێک پێی دەخوێندرێتەوە.",
  },
  "Only the owner changes the café's details.": {
    ar: "المالك وحده يغيّر بيانات المقهى.",
    ckb: "تەنها خاوەن زانیارییەکانی کافێ دەگۆڕێت.",
  },
  "The language of the sign-in screen and of anyone who has not chosen one.": {
    ar: "لغة شاشة الدخول ولغة كل من لم يختر لغة.",
    ckb: "زمانی شاشەی چوونەژوورەوە و زمانی هەر کەسێک کە زمانێکی هەڵنەبژاردووە.",
  },
  "Its sign": { ar: "رمزها", ckb: "هێماکەی" },
  "Decimal places": { ar: "الخانات العشرية", ckb: "ژمارەکانی دوای خاڵ" },
  "Every trading day and period runs midnight to midnight here.": {
    ar: "كل يوم عمل وكل فترة يمتدّان من منتصف الليل إلى منتصف الليل هنا.",
    ckb: "هەموو ڕۆژێکی کار و هەموو ماوەیەک لێرە لە نیوەشەوەوە بۆ نیوەشەو دەڕوات.",
  },
  "Bill numbers start with": {
    ar: "تبدأ أرقام الفواتير بـ",
    ckb: "ژمارەی پسوولەکان دەست پێدەکەن بە",
  },
  "2 to 8 capital letters or digits, a letter first: {prefix}-2026-0001.": {
    ar: "من 2 إلى 8 أحرف كبيرة أو أرقام، أولها حرف: {prefix}-2026-0001.",
    ckb: "2 بۆ 8 پیتی گەورە یان ژمارە، یەکەمیان پیتە: {prefix}-2026-0001.",
  },

  // Places, on Settings.
  "The place's name": { ar: "اسم المكان", ckb: "ناوی شوێنەکە" },
  "a place": { ar: "مكانًا", ckb: "شوێنێک" },
  "Name in Arabic": { ar: "الاسم بالعربية", ckb: "ناو بە عەرەبی" },
  "Name in Kurdish": { ar: "الاسم بالكردية", ckb: "ناو بە کوردی" },
  "{name} added: it has its till drawer, and every screen and report counts it.": {
    ar: "أُضيف {name}: له درج نقوده، وكل شاشة وتقرير يحتسبه.",
    ckb: "{name} زیاد کرا: دەخیلەی پارەی خۆی هەیە، و هەموو شاشە و ڕاپۆرتێک دەیژمێرێت.",
  },
  "Renamed.": { ar: "تغيّر الاسم.", ckb: "ناوەکەی گۆڕدرا." },
  "{name} is open again.": { ar: "{name} مفتوح من جديد.", ckb: "{name} دووبارە کرایەوە." },
  "{name} is closed.": { ar: "{name} مغلق.", ckb: "{name} داخرا." },
  closed: { ar: "مغلق", ckb: "داخراو" },
  "Why it closes": { ar: "سبب الإغلاق", ckb: "هۆی داخستن" },
  "Close it": { ar: "أغلقه", ckb: "دایبخە" },
  "Add a place": { ar: "أضف مكانًا", ckb: "شوێنێک زیاد بکە" },
  "Kind of place": { ar: "نوع المكان", ckb: "جۆری شوێن" },
  "A new branch sells the whole menu at the menu's prices, and has no stock until some is sent or received there. Give people their place on People.":
    {
      ar: "يبيع الفرع الجديد القائمة كلها بأسعارها، ولا مخزون فيه حتى يُرسل إليه أو يُستلم فيه. حدّد مكان كل شخص في «الأشخاص».",
      ckb: "لقی نوێ هەموو مینیوەکە بە نرخەکانی خۆی دەفرۆشێت، و هیچ کۆگای نییە تا شتێکی بۆ دەنێردرێت یان لەوێ وەردەگیرێت. شوێنی هەر کەسێک لە «خەڵک» دیاری بکە.",
    },

  // A receipt printed again, on Orders.
  "Print receipt again": { ar: "اطبع الإيصال مجددًا", ckb: "پسوولەکە دووبارە چاپ بکەرەوە" },
  "Choose a sale": { ar: "اختر عملية بيع", ckb: "فرۆشتنێک هەڵبژێرە" },
  "A voided sale has no receipt to print": {
    ar: "البيع الملغى ليس له إيصال يُطبع",
    ckb: "فرۆشتنی هەڵوەشاوە پسوولەی نییە بۆ چاپکردن",
  },

  // Backup codes, on My account and at sign-in.
  "You signed in with a backup code: the second step is off, and your other codes are used up. Turn it on again with your new phone.":
    {
      ar: "دخلت برمز احتياطي: الخطوة الثانية متوقفة، وانتهت رموزك الأخرى. فعّلها من جديد بهاتفك الجديد.",
      ckb: "بە کۆدێکی یەدەگ چوویتە ژوورەوە: هەنگاوی دووەم کوژاوەتەوە، و کۆدەکانی ترت بەسەرچوون. بە مۆبایلە نوێیەکەت دووبارە چالاکی بکەرەوە.",
    },
  "Your backup codes": { ar: "رموزك الاحتياطية", ckb: "کۆدە یەدەگەکانت" },
  "Write them down or print them, and keep them away from your phone. If the phone is lost, one of them, typed instead of the six digits, lets you in. Each works once. They are not shown again.":
    {
      ar: "اكتبها أو اطبعها، واحفظها بعيدًا عن هاتفك. إن ضاع الهاتف، يُدخلك أحدها إذا كتبته بدل الأرقام الستة. كل رمز يعمل مرة واحدة. لن تظهر مرة أخرى.",
      ckb: "بیاننووسە یان چاپیان بکە، و دوور لە مۆبایلەکەت هەڵیانبگرە. ئەگەر مۆبایلەکە ون بوو، یەکێکیان لە جیاتی شەش ژمارەکە بنووسە و دەچیتە ژوورەوە. هەر کۆدێک یەک جار کار دەکات. دووبارە پیشان نادرێنەوە.",
    },
  "I have kept them": { ar: "حفظتها", ckb: "هەڵمگرتن" },
  "No backup codes left: make new ones, in case the phone is lost.": {
    ar: "لم تبقَ رموز احتياطية: أنشئ رموزًا جديدة تحسّبًا لضياع الهاتف.",
    ckb: "هیچ کۆدێکی یەدەگ نەماوە: کۆدی نوێ دروست بکە، بۆ ئەگەری ونبوونی مۆبایلەکە.",
  },
  "{n} backup codes left, for when the phone is lost.": {
    ar: "بقي {n} من الرموز الاحتياطية، لحين ضياع الهاتف.",
    ckb: "{n} کۆدی یەدەگ ماوە، بۆ کاتی ونبوونی مۆبایلەکە.",
  },
  "Make new backup codes": { ar: "أنشئ رموزًا احتياطية جديدة", ckb: "کۆدی یەدەگی نوێ دروست بکە" },
  "Type one of the backup codes you kept when you turned the second step on. It takes the second step off, so you can turn it on again with your new phone.":
    {
      ar: "اكتب أحد الرموز الاحتياطية التي حفظتها عند تفعيل الخطوة الثانية. يوقف الخطوة الثانية، لتفعّلها من جديد بهاتفك الجديد.",
      ckb: "یەکێک لەو کۆدە یەدەگانە بنووسە کە کاتی چالاککردنی هەنگاوی دووەم هەڵتگرتن. هەنگاوی دووەم دەکوژێنێتەوە، تا بە مۆبایلە نوێیەکەت دووبارە چالاکی بکەیتەوە.",
    },
  "Backup code": { ar: "رمز احتياطي", ckb: "کۆدی یەدەگ" },
  "Use the six digits instead": {
    ar: "استخدم الأرقام الستة بدلًا منه",
    ckb: "لە جیاتی ئەوە شەش ژمارەکە بەکاربهێنە",
  },
  "Lost your phone? Use a backup code": {
    ar: "أضعت هاتفك؟ استخدم رمزًا احتياطيًا",
    ckb: "مۆبایلەکەت ون کردووە؟ کۆدێکی یەدەگ بەکاربهێنە",
  },
  "A backup code is ten letters and digits, like ABCDE-FGH23": {
    ar: "الرمز الاحتياطي عشرة أحرف وأرقام، مثل ABCDE-FGH23",
    ckb: "کۆدی یەدەگ دە پیت و ژمارەیە، وەک ABCDE-FGH23",
  },

  // Prices by the hour and meal deals.
  "Type the price as a number, e.g. 3500": {
    ar: "اكتب السعر رقمًا، مثل 3500",
    ckb: "نرخەکە بە ژمارە بنووسە، بۆ نموونە 3500",
  },

  // One phone, one person.
  "{name} no longer clocks in on this phone: one phone, one person.": {
    ar: "لم يعد {name} يسجّل حضوره بهذا الهاتف: هاتف واحد لشخص واحد.",
    ckb: "{name} چیتر بەم مۆبایلە ئامادەبوون تۆمار ناکات: یەک مۆبایل بۆ یەک کەس.",
  },
  "The phone was linked to someone else": {
    ar: "رُبط الهاتف بشخص آخر",
    ckb: "مۆبایلەکە بە کەسێکی ترەوە بەسترا",
  },
};

export default phrases;
